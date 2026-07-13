from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from time import perf_counter
import uuid
import warnings

from flask import current_app
from PIL import Image, ImageOps, UnidentifiedImageError

from .storage import path_for_key, remove_file


ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


class ImageUploadError(Exception):
    def __init__(self, code, message, status_code):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _safe_filename(filename):
    name = Path(filename or "image").name
    name = "".join(character for character in name if character.isprintable() and character not in {"/", "\\"})
    return name[:255] or "image"


def _validate_image(raw):
    try:
        Image.MAX_IMAGE_PIXELS = current_app.config["IMAGE_MAX_PIXELS"]
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(raw)) as probe:
                width, height = probe.size
                if width <= 0 or height <= 0 or width * height > current_app.config["IMAGE_MAX_PIXELS"]:
                    raise ImageUploadError("IMAGE_DIMENSIONS_EXCEEDED", "图片像素超过允许范围。", 413)
                if width > current_app.config["IMAGE_MAX_WIDTH"] or height > current_app.config["IMAGE_MAX_HEIGHT"]:
                    raise ImageUploadError("IMAGE_DIMENSIONS_EXCEEDED", "图片宽高超过允许范围。", 413)
                ratio = max(width / height, height / width)
                if ratio > current_app.config["IMAGE_MAX_ASPECT_RATIO"]:
                    raise ImageUploadError("IMAGE_DIMENSIONS_EXCEEDED", "图片长宽比超过允许范围。", 413)
                if getattr(probe, "is_animated", False) or getattr(probe, "n_frames", 1) != 1:
                    raise ImageUploadError("UNSUPPORTED_MEDIA_TYPE", "暂不支持动画图片。", 415)
                image_format = probe.format
                probe.verify()
        image = Image.open(BytesIO(raw))
        image.format = image_format
        if image.format not in ALLOWED_FORMATS:
            raise ImageUploadError("UNSUPPORTED_MEDIA_TYPE", "仅支持 JPEG、PNG 或 WebP 图片。", 415)
        if getattr(image, "is_animated", False) or getattr(image, "n_frames", 1) != 1:
            raise ImageUploadError("UNSUPPORTED_MEDIA_TYPE", "暂不支持动画图片。", 415)
        image = ImageOps.exif_transpose(image)
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        return image
    except ImageUploadError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning, ValueError) as error:
        raise ImageUploadError("UNSUPPORTED_MEDIA_TYPE", "上传文件不是可用的静态图片。", 415) from error


def process_and_store_image(file_storage):
    started_at = perf_counter()
    raw = file_storage.stream.read(current_app.config["IMAGE_MAX_BYTES"] + 1)
    if len(raw) > current_app.config["IMAGE_MAX_BYTES"]:
        raise ImageUploadError("FILE_TOO_LARGE", "图片文件超过 15 MB 限制。", 413)
    if not raw:
        raise ImageUploadError("VALIDATION_ERROR", "请选择需要上传的图片。", 422)

    image = _validate_image(raw)
    width, height = image.size
    created = datetime.now(timezone.utc)
    directory = Path("media") / f"{created:%Y}" / f"{created:%m}"
    image_id = uuid.uuid4().hex
    storage_key = str(directory / f"{image_id}.webp")
    thumbnail_key = str(directory / f"{image_id}_thumb.webp")
    original_path = path_for_key(storage_key)
    thumbnail_path = path_for_key(thumbnail_key)
    original_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        image.save(original_path, format="WEBP", quality=90, method=6)
        thumbnail = image.copy()
        thumbnail.thumbnail(
            (current_app.config["IMAGE_THUMBNAIL_MAX_SIDE"],) * 2,
            Image.Resampling.LANCZOS,
        )
        thumbnail.save(thumbnail_path, format="WEBP", quality=84, method=6)
        size_bytes = original_path.stat().st_size
    except Exception as error:
        remove_file(storage_key)
        remove_file(thumbnail_key)
        raise ImageUploadError("INTERNAL_ERROR", "图片保存失败，请稍后重试。", 500) from error

    current_app.logger.info("image_processed duration_ms=%s width=%s height=%s output_bytes=%s", round((perf_counter() - started_at) * 1000, 2), width, height, size_bytes)

    return {
        "original_filename": _safe_filename(file_storage.filename),
        "storage_key": storage_key,
        "thumbnail_key": thumbnail_key,
        "mime_type": "image/webp",
        "size_bytes": size_bytes,
        "width": width,
        "height": height,
    }
