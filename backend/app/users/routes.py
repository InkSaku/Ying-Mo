from flask import Blueprint, current_app, request
from flask_jwt_extended import jwt_required

from app.auth.routes import _current_user, normalized_username
from app.auth.service import utcnow
from app.common.responses import error_response, success_response
from app.extensions import db
from app.models import Media, MediaPurpose, User
from app.uploads.storage import file_exists, remove_media_files

from .service import public_user_dict


users_bp = Blueprint("users", __name__)


def _validation_error(details):
    return error_response("VALIDATION_ERROR", "请求参数不合法。", 422, details)


def _field_error(field, code, message):
    return {"field": field, "code": code, "message": message}


def _current_avatar(user):
    return db.session.scalar(
        db.select(Media).where(
            Media.owner_id == user.id,
            Media.bound_type == "user_avatar",
            Media.bound_id == user.id,
        )
    )


@users_bp.patch("/me")
@jwt_required(locations=["headers"])
def update_me():
    user = _current_user()
    if user is None:
        return error_response("ACCOUNT_RESTRICTED", "当前账号无法继续使用。", 403)
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return _validation_error([_field_error("body", "invalid_format", "请求体必须是 JSON 对象。")])
    allowed = {"nickname", "bio", "region"}
    unknown = set(payload) - allowed
    if unknown:
        field = sorted(unknown)[0]
        return _validation_error([_field_error(field, "unknown_field", "不支持修改该字段。")])
    if not payload:
        return _validation_error([_field_error("body", "required", "至少需要提交一个可修改字段。")])

    errors = []
    updates = {}
    if "nickname" in payload:
        nickname = payload["nickname"]
        if not isinstance(nickname, str):
            errors.append(_field_error("nickname", "invalid_type", "昵称必须是字符串。"))
        else:
            nickname = nickname.strip()
            if not 1 <= len(nickname) <= 30:
                errors.append(_field_error("nickname", "invalid_length", "昵称长度需为 1 至 30 个字符。"))
            else:
                updates["nickname"] = nickname
    for field, maximum, label in (("bio", 500, "简介"), ("region", 100, "地区")):
        if field not in payload:
            continue
        value = payload[field]
        if value is not None and not isinstance(value, str):
            errors.append(_field_error(field, "invalid_type", f"{label}必须是字符串或 null。"))
        elif isinstance(value, str) and len(value) > maximum:
            errors.append(_field_error(field, "invalid_length", f"{label}最多 {maximum} 个字符。"))
        else:
            updates[field] = value if isinstance(value, str) and value else None
    if errors:
        return _validation_error(errors)
    for field, value in updates.items():
        setattr(user, field, value)
    user.updated_at = utcnow()
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Unable to update user profile")
        return error_response("INTERNAL_ERROR", "资料保存失败，请稍后重试。", 500)
    return success_response(user.to_dict())


@users_bp.put("/me/avatar")
@jwt_required(locations=["headers"])
def set_avatar():
    user = _current_user()
    if user is None:
        return error_response("ACCOUNT_RESTRICTED", "当前账号无法继续使用。", 403)
    payload = request.get_json(silent=True)
    media_id = payload.get("media_id") if isinstance(payload, dict) else None
    if not isinstance(media_id, int) or isinstance(media_id, bool) or media_id <= 0:
        return _validation_error([_field_error("media_id", "invalid_type", "media_id 必须是有效正整数。")])
    media = db.session.get(Media, media_id)
    if media is None:
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    if media.owner_id != user.id:
        return error_response("PERMISSION_DENIED", "无权使用该图片。", 403)
    if media.purpose != MediaPurpose.AVATAR:
        return _validation_error([_field_error("media_id", "invalid_purpose", "只能将头像用途的图片设为头像。")])
    if media.is_bound:
        return error_response("RESOURCE_CONFLICT", "该图片已绑定，不能重复使用。", 409)
    if not file_exists(media.storage_key) or not file_exists(media.thumbnail_key):
        return error_response("RESOURCE_CONFLICT", "图片文件不完整，无法设置头像。", 409)

    old_avatar = _current_avatar(user)
    media.bound_type = "user_avatar"
    media.bound_id = user.id
    media.bound_at = utcnow()
    user.avatar_url = f"/api/v1/uploads/images/{media.public_id}/thumbnail"
    user.updated_at = utcnow()
    if old_avatar is not None:
        db.session.delete(old_avatar)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Unable to set user avatar")
        return error_response("INTERNAL_ERROR", "头像设置失败，请稍后重试。", 500)
    if old_avatar is not None:
        remove_media_files(old_avatar)
    return success_response(user.to_dict())


@users_bp.delete("/me/avatar")
@jwt_required(locations=["headers"])
def remove_avatar():
    user = _current_user()
    if user is None:
        return error_response("ACCOUNT_RESTRICTED", "当前账号无法继续使用。", 403)
    old_avatar = _current_avatar(user)
    user.avatar_url = None
    user.updated_at = utcnow()
    if old_avatar is not None:
        db.session.delete(old_avatar)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Unable to remove user avatar")
        return error_response("INTERNAL_ERROR", "头像删除失败，请稍后重试。", 500)
    if old_avatar is not None:
        remove_media_files(old_avatar)
    return "", 204


@users_bp.get("/<username>")
def get_public_user(username):
    normalized = normalized_username(username)
    user = db.session.scalar(db.select(User).where(User.username_normalized == normalized))
    if user is None:
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    return success_response(public_user_dict(user))
