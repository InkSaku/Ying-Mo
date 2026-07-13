from datetime import timedelta
from types import SimpleNamespace

from flask import Blueprint, current_app, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.auth.routes import _current_user
from app.common.responses import error_response, success_response
from app.extensions import db
from app.models import Media, MediaPurpose
from app.auth.service import utcnow
from app.common.rate_limits import limiter, user_key

from .service import ImageUploadError, process_and_store_image
from .storage import file_exists, path_for_key, remove_media_files


uploads_bp = Blueprint("uploads", __name__)


def _media_or_not_found(public_id):
    media = db.session.scalar(db.select(Media).where(Media.public_id == public_id))
    if media is None:
        return None
    return media


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
    unbound = db.session.scalar(db.select(db.func.count(Media.id)).where(Media.owner_id == user.id, Media.bound_type.is_(None))) or 0
    if unbound >= current_app.config["UPLOAD_UNBOUND_LIMIT"]:
        return error_response("UPLOAD_QUOTA_EXCEEDED", "未使用图片数量已达上限，请先清理。", 429)
    total_bytes = db.session.scalar(db.select(db.func.coalesce(db.func.sum(Media.size_bytes), 0)).where(Media.owner_id == user.id)) or 0
    if total_bytes >= current_app.config["UPLOAD_USER_TOTAL_BYTES"]:
        return error_response("UPLOAD_QUOTA_EXCEEDED", "图片存储空间已达上限。", 413)
    daily_bytes = db.session.scalar(db.select(db.func.coalesce(db.func.sum(Media.size_bytes), 0)).where(Media.owner_id == user.id, Media.created_at >= utcnow() - timedelta(days=1))) or 0
    if daily_bytes >= current_app.config["UPLOAD_USER_DAILY_BYTES"]:
        return error_response("UPLOAD_QUOTA_EXCEEDED", "近 24 小时上传容量已达上限。", 429)
    try:
        attributes = process_and_store_image(request.files["file"])
    except ImageUploadError as error:
        return error_response(error.code, error.message, error.status_code)
    if total_bytes + attributes["size_bytes"] > current_app.config["UPLOAD_USER_TOTAL_BYTES"] or daily_bytes + attributes["size_bytes"] > current_app.config["UPLOAD_USER_DAILY_BYTES"]:
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


def _send_media(public_id, thumbnail=False):
    media = _media_or_not_found(public_id)
    if media is None:
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    if media.bound_type != "user_avatar":
        user = _current_user() if get_jwt_identity() else None
        if media.bound_type in {"life_chapter_cover", "life_post"}:
            from app.life.routes import can_read_media
            permitted = can_read_media(media, user)
        elif media.bound_type in {"game_icon", "game_cover", "game_hero_avatar", "game_map_cover"}:
            from app.games.service import public_media_allowed
            permitted = public_media_allowed(media, user)
        elif media.bound_type == "game_guide_step":
            from app.models import GameGuideStep
            step = db.session.scalar(db.select(GameGuideStep).where(GameGuideStep.media_id == media.id))
            permitted = bool(step and (step.guide.status == "published" or (user and (step.guide.author_id == user.id or user.role in {"content_admin", "system_admin"}))))
        elif media.bound_type == "content_draft":
            from app.models import ContentDraft
            draft = db.session.get(ContentDraft, media.bound_id)
            permitted = bool(draft and user and (draft.owner_id == user.id or user.role in {"content_admin", "system_admin"}))
        else:
            permitted = user is not None and media.owner_id == user.id
        if not permitted:
            return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    key = media.thumbnail_key if thumbnail else media.storage_key
    if not file_exists(key):
        current_app.logger.warning("Media record references a missing file: %s", media.public_id)
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    response = send_file(path_for_key(key), mimetype=media.mime_type, conditional=True, max_age=86400 if media.bound_type == "user_avatar" else 0)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "public, max-age=86400, immutable" if media.bound_type == "user_avatar" else "private, no-store"
    return response


@uploads_bp.get("/images/<uuid:public_id>")
@jwt_required(optional=True, locations=["headers"])
def get_image(public_id):
    return _send_media(str(public_id))


@uploads_bp.get("/images/<uuid:public_id>/thumbnail")
@jwt_required(optional=True, locations=["headers"])
def get_thumbnail(public_id):
    return _send_media(str(public_id), thumbnail=True)


@uploads_bp.delete("/images/<uuid:public_id>")
@jwt_required(locations=["headers"])
def delete_image(public_id):
    media = _media_or_not_found(str(public_id))
    if media is None:
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    user = _current_user()
    if user is None:
        return error_response("ACCOUNT_RESTRICTED", "当前账号无法继续使用。", 403)
    if media.owner_id != user.id:
        return error_response("PERMISSION_DENIED", "无权操作该图片。", 403)
    if media.is_bound:
        return error_response("RESOURCE_CONFLICT", "已绑定的图片不能通过此接口删除。", 409)
    db.session.delete(media)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Unable to delete media record")
        return error_response("INTERNAL_ERROR", "图片删除失败，请稍后重试。", 500)
    remove_media_files(media)
    return "", 204
