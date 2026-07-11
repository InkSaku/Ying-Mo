from flask import Blueprint, current_app, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.auth.routes import _current_user
from app.common.responses import error_response, success_response
from app.extensions import db
from app.models import Media, MediaPurpose

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
    try:
        attributes = process_and_store_image(request.files["file"])
    except ImageUploadError as error:
        return error_response(error.code, error.message, error.status_code)
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
        if user is None or media.owner_id != user.id:
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
