import json
import os
import shutil
import subprocess
import tempfile
import uuid
from datetime import datetime, timezone
from fractions import Fraction
from pathlib import Path
from time import perf_counter

from flask import current_app

from .storage import path_for_key, remove_file, upload_root


class LiveVideoError(Exception):
    def __init__(self, code, message, status_code):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _safe_filename(filename):
    name = Path(filename or "live-photo").name
    name = "".join(
        character
        for character in name
        if character.isprintable() and character not in {"/", "\\"}
    )
    return name[:255] or "live-photo"


def _executable(config_name):
    configured = str(current_app.config[config_name]).strip()
    return shutil.which(configured) if configured else None


def check_media_processor_available():
    missing = [
        label
        for label, config_name in (
            ("FFmpeg", "FFMPEG_BINARY"),
            ("FFprobe", "FFPROBE_BINARY"),
        )
        if not _executable(config_name)
    ]
    if missing:
        current_app.logger.error(
            "media_processor_unavailable missing=%s",
            ",".join(missing),
        )
        raise LiveVideoError(
            "MEDIA_PROCESSOR_UNAVAILABLE",
            "服务器暂未启用动态照片处理功能。",
            503,
        )


def write_upload_to_temp_file(file_storage, target_path):
    maximum = current_app.config["LIVE_VIDEO_MAX_BYTES"]
    total = 0
    with target_path.open("wb") as output:
        while True:
            chunk = file_storage.stream.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > maximum:
                raise LiveVideoError(
                    "FILE_TOO_LARGE",
                    "动态照片不能超过 50 MB。",
                    413,
                )
            output.write(chunk)
    if total == 0:
        raise LiveVideoError("VALIDATION_ERROR", "请选择需要上传的动态照片。", 422)
    return total


def _run(command, operation):
    try:
        result = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=current_app.config["LIVE_VIDEO_PROCESS_TIMEOUT_SECONDS"],
        )
    except subprocess.TimeoutExpired as error:
        current_app.logger.warning("live_video_%s_timeout", operation)
        raise LiveVideoError(
            "VIDEO_PROCESSING_FAILED",
            "暂时无法处理这段动态照片，请重新从相册存储为视频后再试。",
            422,
        ) from error
    except OSError as error:
        current_app.logger.exception("live_video_%s_start_failed", operation)
        raise LiveVideoError(
            "MEDIA_PROCESSOR_UNAVAILABLE",
            "服务器暂未启用动态照片处理功能。",
            503,
        ) from error
    if result.returncode:
        current_app.logger.warning(
            "live_video_%s_failed returncode=%s stderr=%s",
            operation,
            result.returncode,
            (result.stderr or "")[-4000:],
        )
        raise LiveVideoError(
            "VIDEO_PROCESSING_FAILED",
            "暂时无法处理这段动态照片，请重新从相册存储为视频后再试。",
            422,
        )
    return result


def probe_video(path, *, uploaded_input=False):
    command = [
        _executable("FFPROBE_BINARY"),
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(path),
    ]
    try:
        result = _run(command, "probe")
    except LiveVideoError as error:
        if uploaded_input and error.code == "VIDEO_PROCESSING_FAILED":
            raise LiveVideoError(
                "INVALID_VIDEO",
                "文件中没有可播放的视频画面。",
                415,
            ) from error
        raise
    try:
        return json.loads(result.stdout)
    except (TypeError, json.JSONDecodeError) as error:
        current_app.logger.warning("live_video_probe_invalid_json")
        raise LiveVideoError(
            "INVALID_VIDEO",
            "文件中没有可播放的视频画面。",
            415,
        ) from error


def _positive_float(value):
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _duration_seconds(probe, video_stream):
    candidates = [
        _positive_float(video_stream.get("duration")),
        _positive_float((probe.get("format") or {}).get("duration")),
        *[
            _positive_float(stream.get("duration"))
            for stream in (probe.get("streams") or [])
        ],
    ]
    durations = [value for value in candidates if value is not None]
    return max(durations) if durations else None


def _frame_rate(video_stream):
    for key in ("avg_frame_rate", "r_frame_rate"):
        value = video_stream.get(key)
        try:
            rate = float(Fraction(value))
        except (TypeError, ValueError, ZeroDivisionError):
            continue
        if 0 < rate <= 240:
            return rate
    return None


def _rotation(video_stream):
    for side_data in video_stream.get("side_data_list") or []:
        try:
            return int(float(side_data.get("rotation", 0))) % 360
        except (TypeError, ValueError):
            continue
    try:
        return int(float((video_stream.get("tags") or {}).get("rotate", 0))) % 360
    except (TypeError, ValueError):
        return 0


def validate_live_video(probe, *, output=False):
    streams = probe.get("streams")
    if not isinstance(streams, list):
        streams = []
    videos = [
        stream
        for stream in streams
        if stream.get("codec_type") == "video"
        and not (stream.get("disposition") or {}).get("attached_pic")
        and int(stream.get("width") or 0) > 0
        and int(stream.get("height") or 0) > 0
    ]
    if not videos:
        raise LiveVideoError(
            "INVALID_VIDEO",
            "文件中没有可播放的视频画面。",
            415,
        )
    video = videos[0]
    width, height = int(video["width"]), int(video["height"])
    duration = _duration_seconds(probe, video)
    if not duration:
        raise LiveVideoError("INVALID_VIDEO", "文件中没有可播放的视频画面。", 415)
    if round(duration * 1000) > current_app.config["LIVE_VIDEO_MAX_DURATION_MS"]:
        raise LiveVideoError(
            "VIDEO_DURATION_EXCEEDED",
            "动态照片最长支持 10 秒。",
            413,
        )
    if (
        width < 2
        or height < 2
        or width > current_app.config["IMAGE_MAX_WIDTH"]
        or height > current_app.config["IMAGE_MAX_HEIGHT"]
        or width * height > current_app.config["IMAGE_MAX_PIXELS"]
        or max(width / height, height / width)
        > current_app.config["IMAGE_MAX_ASPECT_RATIO"]
    ):
        raise LiveVideoError(
            "UNSUPPORTED_MEDIA_TYPE",
            "选择的文件不是可用的动态照片视频。",
            415,
        )
    rotation = _rotation(video)
    display_width, display_height = (
        (height, width) if rotation in {90, 270} else (width, height)
    )
    audio_streams = [
        stream for stream in streams if stream.get("codec_type") == "audio"
    ]
    if output:
        format_name = str((probe.get("format") or {}).get("format_name") or "")
        if video.get("codec_name") != "h264" or video.get("pix_fmt") != "yuv420p" or "mp4" not in format_name:
            raise LiveVideoError(
                "VIDEO_PROCESSING_FAILED",
                "暂时无法处理这段动态照片，请重新从相册存储为视频后再试。",
                422,
            )
        if width % 2 or height % 2:
            raise LiveVideoError(
                "VIDEO_PROCESSING_FAILED",
                "暂时无法处理这段动态照片，请重新从相册存储为视频后再试。",
                422,
            )
        if any(stream.get("codec_name") != "aac" for stream in audio_streams):
            raise LiveVideoError(
                "VIDEO_PROCESSING_FAILED",
                "暂时无法处理这段动态照片，请重新从相册存储为视频后再试。",
                422,
            )
        if len(videos) != 1 or len(audio_streams) > 1 or any(
            stream.get("codec_type") not in {"video", "audio"}
            for stream in streams
        ):
            raise LiveVideoError(
                "VIDEO_PROCESSING_FAILED",
                "暂时无法处理这段动态照片，请重新从相册存储为视频后再试。",
                422,
            )
    return {
        "duration_seconds": duration,
        "duration_ms": round(duration * 1000),
        "width": display_width,
        "height": display_height,
        "frame_rate": _frame_rate(video),
        "has_audio": bool(audio_streams),
        "video_stream_index": int(video.get("index", 0)),
        "audio_stream_index": (
            int(audio_streams[0].get("index", 0)) if audio_streams else None
        ),
    }


def build_transcode_command(input_path, output_path, source):
    filters = [
        (
            "scale="
            f"w='min({current_app.config['LIVE_VIDEO_MAX_SIDE']},iw)':"
            f"h='min({current_app.config['LIVE_VIDEO_MAX_SIDE']},ih)':"
            "force_original_aspect_ratio=decrease:force_divisible_by=2:"
            "flags=lanczos"
        )
    ]
    command = [
        _executable("FFMPEG_BINARY"),
        "-hide_banner",
        "-nostdin",
        "-y",
        "-i",
        str(input_path),
        "-map",
        f"0:{source['video_stream_index']}",
        "-sn",
        "-dn",
        "-map_metadata",
        "-1",
        "-map_chapters",
        "-1",
        "-vf",
        ",".join(filters),
        "-fpsmax",
        f"{current_app.config['LIVE_VIDEO_MAX_FPS']:g}",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        current_app.config["LIVE_VIDEO_PRESET"],
        "-crf",
        str(current_app.config["LIVE_VIDEO_CRF"]),
        "-maxrate",
        current_app.config["LIVE_VIDEO_MAXRATE"],
        "-bufsize",
        current_app.config["LIVE_VIDEO_BUFSIZE"],
    ]
    if source["has_audio"]:
        command.extend(
            [
                "-map",
                f"0:{source['audio_stream_index']}?",
                "-c:a",
                "aac",
                "-b:a",
                current_app.config["LIVE_VIDEO_AUDIO_BITRATE"],
            ]
        )
    else:
        command.append("-an")
    command.extend(["-movflags", "+faststart", str(output_path)])
    return command


def transcode_live_video(input_path, output_path, source):
    _run(build_transcode_command(input_path, output_path, source), "transcode")
    if not output_path.is_file() or output_path.stat().st_size <= 0:
        raise LiveVideoError(
            "VIDEO_PROCESSING_FAILED",
            "暂时无法处理这段动态照片，请重新从相册存储为视频后再试。",
            422,
        )


def generate_video_poster(video_path, poster_path, duration_seconds):
    seek_seconds = min(0.5, duration_seconds / 2)
    poster_side = current_app.config["LIVE_VIDEO_POSTER_MAX_SIDE"]
    command = [
        _executable("FFMPEG_BINARY"),
        "-hide_banner",
        "-nostdin",
        "-y",
        "-ss",
        f"{seek_seconds:.3f}",
        "-i",
        str(video_path),
        "-map",
        "0:v:0",
        "-frames:v",
        "1",
        "-an",
        "-sn",
        "-dn",
        "-vf",
        (
            f"scale=w='min({poster_side},iw)':h='min({poster_side},ih)':"
            "force_original_aspect_ratio=decrease:flags=lanczos"
        ),
        "-c:v",
        "libwebp",
        "-quality",
        "84",
        "-compression_level",
        "6",
        str(poster_path),
    ]
    _run(command, "poster")
    if not poster_path.is_file() or poster_path.stat().st_size <= 0:
        raise LiveVideoError(
            "VIDEO_PROCESSING_FAILED",
            "暂时无法生成动态照片封面，请稍后重试。",
            422,
        )


def process_and_store_live_video(file_storage):
    started_at = perf_counter()
    check_media_processor_available()
    temporary_root = upload_root() / ".tmp"
    temporary_root.mkdir(parents=True, exist_ok=True)
    created = datetime.now(timezone.utc)
    directory = Path("media") / f"{created:%Y}" / f"{created:%m}"
    media_id = uuid.uuid4().hex
    storage_key = str(directory / f"{media_id}.mp4")
    thumbnail_key = str(directory / f"{media_id}_thumb.webp")
    final_video = path_for_key(storage_key)
    final_poster = path_for_key(thumbnail_key)
    moved_video = moved_poster = False

    try:
        with tempfile.TemporaryDirectory(prefix="live-", dir=temporary_root) as work:
            work_path = Path(work)
            input_path = work_path / "input"
            output_path = work_path / "output.mp4"
            poster_path = work_path / "poster.webp"
            input_bytes = write_upload_to_temp_file(file_storage, input_path)
            source = validate_live_video(probe_video(input_path, uploaded_input=True))
            transcode_live_video(input_path, output_path, source)
            result = validate_live_video(probe_video(output_path), output=True)
            if (
                max(result["width"], result["height"])
                > current_app.config["LIVE_VIDEO_MAX_SIDE"]
                or (
                    result["frame_rate"]
                    and result["frame_rate"] > current_app.config["LIVE_VIDEO_MAX_FPS"] + 0.01
                )
            ):
                raise LiveVideoError(
                    "VIDEO_PROCESSING_FAILED",
                    "暂时无法处理这段动态照片，请重新从相册存储为视频后再试。",
                    422,
                )
            generate_video_poster(
                output_path,
                poster_path,
                result["duration_seconds"],
            )
            final_video.parent.mkdir(parents=True, exist_ok=True)
            os.replace(output_path, final_video)
            moved_video = True
            os.replace(poster_path, final_poster)
            moved_poster = True
            output_bytes = final_video.stat().st_size
    except LiveVideoError:
        if moved_video:
            remove_file(storage_key)
        if moved_poster:
            remove_file(thumbnail_key)
        raise
    except Exception as error:
        if moved_video:
            remove_file(storage_key)
        if moved_poster:
            remove_file(thumbnail_key)
        current_app.logger.exception("live_video_processing_unexpected")
        raise LiveVideoError(
            "VIDEO_PROCESSING_FAILED",
            "暂时无法处理这段动态照片，请重新从相册存储为视频后再试。",
            422,
        ) from error

    current_app.logger.info(
        "live_video_processed input_bytes=%s output_bytes=%s duration_ms=%s "
        "width=%s height=%s has_audio=%s processing_ms=%s",
        input_bytes,
        output_bytes,
        result["duration_ms"],
        result["width"],
        result["height"],
        result["has_audio"],
        round((perf_counter() - started_at) * 1000, 2),
    )
    return {
        "original_filename": _safe_filename(file_storage.filename),
        "storage_key": storage_key,
        "thumbnail_key": thumbnail_key,
        "mime_type": "video/mp4",
        "media_type": "live_video",
        "size_bytes": output_bytes,
        "width": result["width"],
        "height": result["height"],
        "duration_ms": result["duration_ms"],
        "has_audio": result["has_audio"],
    }
