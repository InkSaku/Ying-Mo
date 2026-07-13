from functools import wraps
from flask_jwt_extended import jwt_required

from app.auth.routes import _current_user
from app.common.responses import error_response
from app.models import UserRole, UserStatus


def is_content_admin(user):
    return bool(user and user.status == UserStatus.ACTIVE.value and user.role in {UserRole.CONTENT_ADMIN.value, UserRole.SYSTEM_ADMIN.value})


def is_system_admin(user):
    return bool(user and user.status == UserStatus.ACTIVE.value and user.role == UserRole.SYSTEM_ADMIN.value)


def require_content_admin():
    def decorate(fn):
        @wraps(fn)
        @jwt_required(locations=["headers"])
        def wrapped(*args, **kwargs):
            user = _current_user()
            if not is_content_admin(user): return error_response("PERMISSION_DENIED", "需要内容管理员权限。", 403)
            return fn(user, *args, **kwargs)
        return wrapped
    return decorate


def require_system_admin():
    def decorate(fn):
        @wraps(fn)
        @jwt_required(locations=["headers"])
        def wrapped(*args, **kwargs):
            user = _current_user()
            if not is_system_admin(user): return error_response("PERMISSION_DENIED", "需要系统管理员权限。", 403)
            return fn(user, *args, **kwargs)
        return wrapped
    return decorate


def can_manage_user(actor, target):
    if not target or target.status == UserStatus.DEACTIVATED.value: return False
    if actor.id == target.id: return False
    if is_system_admin(actor): return True
    return is_content_admin(actor) and target.role == UserRole.USER.value
