from datetime import datetime
from io import BytesIO
from pathlib import Path
import uuid

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
        with Image.open(BytesIO(raw)) as probe:
            probe.verify()
        image = Image.open(BytesIO(raw))
        if image.format not in ALLOWED_FORMATS:
            raise ImageUploadError("UNSUPPORTED_MEDIA_TYPE", "仅支持 JPEG、PNG 或 WebP 图片。", 415)
        if getattr(image, "is_animated", False) or getattr(image, "n_frames", 1) != 1:
            raise ImageUploadError("UNSUPPORTED_MEDIA_TYPE", "暂不支持动画图片。", 415)
        image = ImageOps.exif_transpose(image)
        width, height = image.size
        if width <= 0 or height <= 0 or width * height > current_app.config["IMAGE_MAX_PIXELS"]:
            raise ImageUploadError("UNSUPPORTED_MEDIA_TYPE", "图片尺寸超过允许范围。", 415)
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        return image
    except ImageUploadError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError) as error:
        raise ImageUploadError("UNSUPPORTED_MEDIA_TYPE", "上传文件不是可用的静态图片。", 415) from error


def process_and_store_image(file_storage):
    raw = file_storage.stream.read(current_app.config["IMAGE_MAX_BYTES"] + 1)
    if len(raw) > current_app.config["IMAGE_MAX_BYTES"]:
        raise ImageUploadError("FILE_TOO_LARGE", "图片文件超过 15 MB 限制。", 413)
    if not raw:
        raise ImageUploadError("VALIDATION_ERROR", "请选择需要上传的图片。", 422)

    image = _validate_image(raw)
    width, height = image.size
    created = datetime.utcnow()
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
    except (OSError, ValueError) as error:
        remove_file(storage_key)
        remove_file(thumbnail_key)
        raise ImageUploadError("INTERNAL_ERROR", "图片保存失败，请稍后重试。", 500) from error

    return {
        "original_filename": _safe_filename(file_storage.filename),
        "storage_key": storage_key,
        "thumbnail_key": thumbnail_key,
        "mime_type": "image/webp",
        "size_bytes": size_bytes,
        "width": width,
        "height": height,
    }
