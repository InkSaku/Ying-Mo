from datetime import timedelta
from types import SimpleNamespace

from flask import Blueprint, current_app, request, send_file, url_for
from flask_jwt_extended import get_jwt_identity, jwt_required
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.auth.routes import _current_user
from app.common.responses import error_response, success_response
from app.extensions import db
from app.models import Media, MediaPurpose, MediaType
from app.auth.service import utcnow
from app.common.rate_limits import limiter, user_key

from .service import ImageUploadError, process_and_store_image
from .storage import file_exists, path_for_key, remove_media_files
from .video_service import LiveVideoError, process_and_store_live_video


uploads_bp = Blueprint("uploads", __name__)


def _media_or_not_found(public_id):
    media = db.session.scalar(db.select(Media).where(Media.public_id == public_id))
    if media is None:
        return None
    return media


def _usage_for_user(user_id):
    unbound = db.session.scalar(
        db.select(db.func.count(Media.id)).where(
            Media.owner_id == user_id,
            Media.bound_type.is_(None),
        )
    ) or 0
    total_bytes = db.session.scalar(
        db.select(db.func.coalesce(db.func.sum(Media.size_bytes), 0)).where(
            Media.owner_id == user_id
        )
    ) or 0
    daily_bytes = db.session.scalar(
        db.select(db.func.coalesce(db.func.sum(Media.size_bytes), 0)).where(
            Media.owner_id == user_id,
            Media.created_at >= utcnow() - timedelta(days=1),
        )
    ) or 0
    return unbound, total_bytes, daily_bytes


def _quota_error(user_id, noun, total_status=429):
    unbound, total_bytes, daily_bytes = _usage_for_user(user_id)
    if unbound >= current_app.config["UPLOAD_UNBOUND_LIMIT"]:
        return None, error_response(
            "UPLOAD_QUOTA_EXCEEDED",
            f"未使用{noun}数量已达上限，请先清理。",
            429,
        )
    if total_bytes >= current_app.config["UPLOAD_USER_TOTAL_BYTES"]:
        return None, error_response(
            "UPLOAD_QUOTA_EXCEEDED",
            f"{noun}存储空间已达上限。",
            total_status,
        )
    if daily_bytes >= current_app.config["UPLOAD_USER_DAILY_BYTES"]:
        return None, error_response(
            "UPLOAD_QUOTA_EXCEEDED",
            "近 24 小时上传容量已达上限。",
            429,
        )
    return (total_bytes, daily_bytes), None


def _within_final_quota(usage, size_bytes):
    total_bytes, daily_bytes = usage
    return (
        total_bytes + size_bytes <= current_app.config["UPLOAD_USER_TOTAL_BYTES"]
        and daily_bytes + size_bytes <= current_app.config["UPLOAD_USER_DAILY_BYTES"]
    )


@uploads_bp.post("/images")
@jwt_required(locations=["headers"])
@limiter.limit(lambda: current_app.config["RATE_LIMIT_UPLOAD"], key_func=user_key, methods=["POST"])
def upload_image():
    user = _current_user()
    if user is None:
        return error_response("ACCOUNT_RESTRICTED", "当前账号无法继续使用。", 403)
    if "file" not in request.files:
        return error_response("VALIDATION_ERROR", "请选择需要上传的图片。", 422, [{"field": "file", "code": "required", "message": "请选择需要上传的图片。"}])
    if len(request.files.getlist("file")) != 1:
        return error_response("VALIDATION_ERROR", "一次只能上传一张图片。", 422, [{"field": "file", "code": "too_many", "message": "一次只能上传一张图片。"}])
    purpose = request.form.get("purpose", MediaPurpose.CONTENT)
    if purpose not in MediaPurpose.ALL:
        return error_response("VALIDATION_ERROR", "图片用途不合法。", 422, [{"field": "purpose", "code": "invalid_choice", "message": "图片用途仅支持 avatar 或 content。"}])
    usage, quota_error = _quota_error(user.id, "图片", total_status=413)
    if quota_error:
        return quota_error
    try:
        attributes = process_and_store_image(request.files["file"])
    except ImageUploadError as error:
        return error_response(error.code, error.message, error.status_code)
    if not _within_final_quota(usage, attributes["size_bytes"]):
        remove_media_files(SimpleNamespace(**attributes))
        return error_response("UPLOAD_QUOTA_EXCEEDED", "图片存储配额不足。", 413)
    media = Media(owner_id=user.id, purpose=purpose, **attributes)
    try:
        db.session.add(media)
        db.session.commit()
    except Exception:
        db.session.rollback()
        remove_media_files(media)
        current_app.logger.exception("Unable to persist uploaded media")
        return error_response("INTERNAL_ERROR", "图片上传失败，请稍后重试。", 500)
    return success_response(media.to_dict(), 201)


@uploads_bp.post("/media")
@jwt_required(locations=["headers"])
@limiter.limit(lambda: current_app.config["RATE_LIMIT_UPLOAD"], key_func=user_key, methods=["POST"])
def upload_media():
    user = _current_user()
    if user is None:
        return error_response("ACCOUNT_RESTRICTED", "当前账号无法继续使用。", 403)
    if "file" not in request.files:
        return error_response(
            "VALIDATION_ERROR",
            "请选择需要上传的动态照片。",
            422,
            [{"field": "file", "code": "required", "message": "请选择需要上传的动态照片。"}],
        )
    if len(request.files.getlist("file")) != 1:
        return error_response(
            "VALIDATION_ERROR",
            "一次只能上传一个动态照片。",
            422,
            [{"field": "file", "code": "too_many", "message": "一次只能上传一个动态照片。"}],
        )
    if request.form.get("media_type") != MediaType.LIVE_VIDEO:
        return error_response(
            "VALIDATION_ERROR",
            "动态照片类型不合法。",
            422,
            [{"field": "media_type", "code": "invalid_choice", "message": "仅支持上传动态照片。"}],
        )
    if request.form.get("purpose") != MediaPurpose.CONTENT:
        return error_response(
            "VALIDATION_ERROR",
            "动态照片只能用于日常内容。",
            422,
            [{"field": "purpose", "code": "invalid_choice", "message": "动态照片只能用于日常内容。"}],
        )
    usage, quota_error = _quota_error(user.id, "媒体")
    if quota_error:
        return quota_error
    try:
        attributes = process_and_store_live_video(request.files["file"])
    except LiveVideoError as error:
        return error_response(error.code, error.message, error.status_code)
    if not _within_final_quota(usage, attributes["size_bytes"]):
        remove_media_files(SimpleNamespace(**attributes))
        return error_response("UPLOAD_QUOTA_EXCEEDED", "媒体存储配额不足。", 429)
    media = Media(owner_id=user.id, purpose=MediaPurpose.CONTENT, **attributes)
    try:
        db.session.add(media)
        db.session.commit()
    except Exception:
        db.session.rollback()
        remove_media_files(media)
        current_app.logger.exception("Unable to persist uploaded live video")
        return error_response("INTERNAL_ERROR", "动态照片上传失败，请稍后重试。", 500)
    current_app.logger.info(
        "live_video_saved media_public_id=%s user_id=%s output_bytes=%s",
        media.public_id,
        user.id,
        media.size_bytes,
    )
    return success_response(media.to_dict(), 201)


def _media_access_allowed(media, user):
    if media.bound_type == "user_avatar":
        return True
    if media.bound_type in {"life_chapter_cover", "life_post"}:
        from app.life.routes import can_read_media
        return can_read_media(media, user)
    if media.bound_type in {"game_icon", "game_cover", "game_hero_avatar", "game_map_cover"}:
        from app.games.service import public_media_allowed
        return public_media_allowed(media, user)
    if media.bound_type == "game_guide_step":
        from app.models import GameGuideStep
        step = db.session.scalar(
            db.select(GameGuideStep).where(GameGuideStep.media_id == media.id)
        )
        return bool(
            step
            and (
                step.guide.status == "published"
                or (
                    user
                    and (
                        step.guide.author_id == user.id
                        or user.role in {"content_admin", "system_admin"}
                    )
                )
            )
        )
    if media.bound_type == "content_draft":
        from app.models import ContentDraft
        draft = db.session.get(ContentDraft, media.bound_id)
        return bool(
            draft
            and user
            and (
                draft.owner_id == user.id
                or user.role in {"content_admin", "system_admin"}
            )
        )
    return bool(user and media.owner_id == user.id)


def _send_media(public_id, thumbnail=False):
    media = _media_or_not_found(public_id)
    if media is None or media.media_type != MediaType.IMAGE:
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    user = _current_user() if get_jwt_identity() else None
    if not _media_access_allowed(media, user):
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    key = media.thumbnail_key if thumbnail else media.storage_key
    if not file_exists(key):
        current_app.logger.warning("Media record references a missing file: %s", media.public_id)
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    response = send_file(path_for_key(key), mimetype=media.mime_type, conditional=True, max_age=86400 if media.bound_type == "user_avatar" else 0)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "public, max-age=86400, immutable" if media.bound_type == "user_avatar" else "private, no-store"
    return response


def _playback_serializer():
    return URLSafeTimedSerializer(
        current_app.config["SECRET_KEY"],
        salt="life-live-video-playback-v1",
    )


@uploads_bp.get("/images/<uuid:public_id>")
@jwt_required(optional=True, locations=["headers"])
def get_image(public_id):
    return _send_media(str(public_id))


@uploads_bp.get("/images/<uuid:public_id>/thumbnail")
@jwt_required(optional=True, locations=["headers"])
def get_thumbnail(public_id):
    return _send_media(str(public_id), thumbnail=True)


@uploads_bp.get("/media/<uuid:public_id>/thumbnail")
@jwt_required(optional=True, locations=["headers"])
def get_media_thumbnail(public_id):
    media = _media_or_not_found(str(public_id))
    if media is None or media.media_type != MediaType.LIVE_VIDEO:
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    user = _current_user() if get_jwt_identity() else None
    if not _media_access_allowed(media, user):
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    if not file_exists(media.thumbnail_key):
        current_app.logger.warning(
            "Media record references a missing thumbnail: %s",
            media.public_id,
        )
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    response = send_file(
        path_for_key(media.thumbnail_key),
        mimetype="image/webp",
        conditional=True,
        max_age=0,
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "private, no-store"
    return response


@uploads_bp.get("/media/<uuid:public_id>/playback-url")
@jwt_required(optional=True, locations=["headers"])
def get_media_playback_url(public_id):
    media = _media_or_not_found(str(public_id))
    if media is None or media.media_type != MediaType.LIVE_VIDEO:
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    user = _current_user() if get_jwt_identity() else None
    if not _media_access_allowed(media, user):
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    ttl = current_app.config["MEDIA_PLAYBACK_URL_TTL_SECONDS"]
    token = _playback_serializer().dumps({"public_id": media.public_id})
    return success_response(
        {
            "url": url_for(
                "uploads.stream_media",
                public_id=media.public_id,
                token=token,
            ),
            "expires_in": ttl,
        }
    )


@uploads_bp.get("/media/<uuid:public_id>/stream")
def stream_media(public_id):
    token = request.args.get("token", "")
    if not token:
        return error_response("PLAYBACK_TOKEN_REQUIRED", "播放地址无效。", 401)
    try:
        signed = _playback_serializer().loads(
            token,
            max_age=current_app.config["MEDIA_PLAYBACK_URL_TTL_SECONDS"],
        )
    except SignatureExpired:
        return error_response("PLAYBACK_TOKEN_EXPIRED", "播放地址已过期。", 401)
    except BadSignature:
        return error_response("PLAYBACK_TOKEN_INVALID", "播放地址无效。", 403)
    if signed.get("public_id") != str(public_id):
        return error_response("PLAYBACK_TOKEN_INVALID", "播放地址无效。", 403)
    media = _media_or_not_found(str(public_id))
    if media is None or media.media_type != MediaType.LIVE_VIDEO:
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    if not file_exists(media.storage_key):
        current_app.logger.warning(
            "Live video record references a missing file: %s",
            media.public_id,
        )
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    response = send_file(
        path_for_key(media.storage_key),
        mimetype="video/mp4",
        conditional=True,
        as_attachment=False,
        download_name=f"{media.public_id}.mp4",
        max_age=0,
    )
    response.headers["Content-Disposition"] = (
        f'inline; filename="{media.public_id}.mp4"'
    )
    response.headers["Accept-Ranges"] = "bytes"
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


def _delete_unbound_media(public_id, expected_type=None):
    media = _media_or_not_found(str(public_id))
    if media is None or (expected_type and media.media_type != expected_type):
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    user = _current_user()
    if user is None:
        return error_response("ACCOUNT_RESTRICTED", "当前账号无法继续使用。", 403)
    if media.owner_id != user.id:
        return error_response("PERMISSION_DENIED", "无权操作该媒体。", 403)
    if media.is_bound:
        return error_response("RESOURCE_CONFLICT", "已绑定的媒体不能通过此接口删除。", 409)
    db.session.delete(media)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Unable to delete media record")
        return error_response("INTERNAL_ERROR", "媒体删除失败，请稍后重试。", 500)
    if not remove_media_files(media):
        current_app.logger.warning(
            "Unable to fully remove unbound media files: %s",
            media.public_id,
        )
    return "", 204


@uploads_bp.delete("/images/<uuid:public_id>")
@jwt_required(locations=["headers"])
def delete_image(public_id):
    return _delete_unbound_media(public_id, MediaType.IMAGE)


@uploads_bp.delete("/media/<uuid:public_id>")
@jwt_required(locations=["headers"])
def delete_media(public_id):
    return _delete_unbound_media(public_id)
