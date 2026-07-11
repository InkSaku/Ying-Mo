import re

from flask import Blueprint, make_response, request
from flask_jwt_extended import (
    get_jwt,
    get_jwt_identity,
    jwt_required,
    set_refresh_cookies,
    unset_jwt_cookies,
)
from sqlalchemy.exc import IntegrityError

from app.auth.service import find_user, issue_session, revoke_session, rotate_session, utcnow
from app.common.responses import error_response, success_response
from app.extensions import db, jwt
from app.models import User, UserStatus


auth_bp = Blueprint("auth", __name__)
USERNAME_RE = re.compile(r"^[\w-]{2,20}$", re.UNICODE)
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def validation_error(details):
    return error_response("VALIDATION_ERROR", "请求参数不合法。", 422, details)


def field_error(field, code, message):
    return {"field": field, "code": code, "message": message}


def normalized_username(value):
    return value.strip().lower() if isinstance(value, str) else ""


def validated_registration(payload):
    errors = []
    username = payload.get("username")
    email = payload.get("email")
    password = payload.get("password")
    confirmation = payload.get("password_confirmation")
    if not isinstance(username, str) or not USERNAME_RE.fullmatch(username.strip()):
        errors.append(field_error("username", "invalid_format", "用户名为 2 至 20 个中英文、数字、下划线或短横线字符。"))
    if not isinstance(email, str) or not EMAIL_RE.fullmatch(email.strip().lower()):
        errors.append(field_error("email", "invalid_format", "请输入有效邮箱地址。"))
    if not isinstance(password, str) or not 8 <= len(password) <= 128:
        errors.append(field_error("password", "invalid_length", "密码长度需为 8 至 128 个字符。"))
    if password != confirmation:
        errors.append(field_error("password_confirmation", "not_match", "两次输入的密码不一致。"))
    if payload.get("accept_terms") is not True:
        errors.append(field_error("accept_terms", "required", "请确认用户协议。"))
    return errors, username.strip() if isinstance(username, str) else "", email.strip().lower() if isinstance(email, str) else ""


def session_response(user, access_token, refresh_token, status_code=200):
    response, actual_status = success_response({"access_token": access_token, "user": user.to_dict()}, status_code)
    set_refresh_cookies(response, refresh_token)
    return response, actual_status


@auth_bp.post("/register")
def register():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return validation_error([field_error("body", "invalid_format", "请求体必须是 JSON 对象。")])
    errors, username, email = validated_registration(payload)
    if errors:
        return validation_error(errors)
    username_normalized = normalized_username(username)
    if db.session.scalar(db.select(User.id).where(User.username_normalized == username_normalized)):
        return error_response("DUPLICATE_RESOURCE", "用户名已被使用。", 409)
    if db.session.scalar(db.select(User.id).where(User.email_normalized == email)):
        return error_response("DUPLICATE_RESOURCE", "邮箱已被使用。", 409)
    user = User(username=username, username_normalized=username_normalized, email=email, email_normalized=email, nickname=username)
    user.set_password(payload["password"])
    try:
        db.session.add(user)
        db.session.flush()
        access_token, refresh_token = issue_session(user)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return error_response("DUPLICATE_RESOURCE", "用户名或邮箱已被使用。", 409)
    return session_response(user, access_token, refresh_token, 201)


@auth_bp.post("/login")
def login():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict) or not isinstance(payload.get("identifier"), str) or not isinstance(payload.get("password"), str):
        return validation_error([field_error("identifier", "required", "请输入用户名或邮箱及密码。")])
    user = find_user(payload["identifier"])
    if user is None or not user.check_password(payload["password"]):
        return error_response("INVALID_CREDENTIALS", "用户名、邮箱或密码错误。", 401)
    if not user.is_login_allowed:
        return error_response("ACCOUNT_RESTRICTED", "当前账号无法登录。", 403)
    user.last_login_at = utcnow()
    access_token, refresh_token = issue_session(user)
    db.session.commit()
    return session_response(user, access_token, refresh_token)


@auth_bp.post("/refresh")
@jwt_required(refresh=True, locations=["cookies"])
def refresh():
    user = _current_user()
    if user is None:
        return error_response("ACCOUNT_RESTRICTED", "当前账号无法继续使用。", 403)
    tokens = rotate_session(user, get_jwt()["jti"])
    if tokens is None:
        return error_response("TOKEN_REVOKED", "当前会话已失效，请重新登录。", 401)
    access_token, refresh_token = tokens
    db.session.commit()
    return session_response(user, access_token, refresh_token)


@auth_bp.get("/me")
@jwt_required(locations=["headers"])
def me():
    user = _current_user()
    if user is None:
        return error_response("ACCOUNT_RESTRICTED", "当前账号无法继续使用。", 403)
    return success_response(user.to_dict())


@auth_bp.post("/logout")
@jwt_required(refresh=True, locations=["cookies"], optional=True)
def logout():
    identity = get_jwt_identity()
    if identity:
        revoke_session(int(identity), get_jwt()["jti"])
    response = make_response("", 204)
    unset_jwt_cookies(response)
    return response


def _current_user():
    identity = get_jwt_identity()
    if identity is None:
        return None
    user = db.session.get(User, int(identity))
    if user is None or user.status != UserStatus.ACTIVE.value:
        return None
    return user


@jwt.user_lookup_loader
def load_jwt_user(_header, payload):
    try:
        user = db.session.get(User, int(payload["sub"]))
    except (KeyError, TypeError, ValueError):
        return None
    return user if user and user.status == UserStatus.ACTIVE.value else None
