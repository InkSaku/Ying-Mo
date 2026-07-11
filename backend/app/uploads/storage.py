import logging
from pathlib import Path

from flask import current_app


def upload_root():
    root = Path(current_app.config["UPLOAD_ROOT"]).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def path_for_key(storage_key):
    root = upload_root()
    candidate = (root / storage_key).resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError("unsafe storage key")
    return candidate


def file_exists(storage_key):
    try:
        return path_for_key(storage_key).is_file()
    except ValueError:
        return False


def remove_file(storage_key):
    try:
        path = path_for_key(storage_key)
        if path.exists():
            path.unlink()
    except (OSError, ValueError):
        current_app.logger.warning("Unable to remove media file", exc_info=True)


def remove_media_files(media):
    remove_file(media.storage_key)
    remove_file(media.thumbnail_key)
