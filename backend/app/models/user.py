from datetime import datetime, timezone
from enum import StrEnum

from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db


def utcnow():
    return datetime.now(timezone.utc)


def serialize_datetime(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


class UserRole(StrEnum):
    USER = "user"
    CONTENT_ADMIN = "content_admin"
    SYSTEM_ADMIN = "system_admin"


class UserStatus(StrEnum):
    ACTIVE = "active"
    BANNED = "banned"
    DEACTIVATED = "deactivated"


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(20), nullable=False)
    username_normalized = db.Column(db.String(20), nullable=False, unique=True, index=True)
    email = db.Column(db.String(254), nullable=False)
    email_normalized = db.Column(db.String(254), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    nickname = db.Column(db.String(30), nullable=False)
    avatar_url = db.Column(db.String(512), nullable=True)
    bio = db.Column(db.String(500), nullable=True)
    region = db.Column(db.String(100), nullable=True)
    role = db.Column(db.String(32), nullable=False, default=UserRole.USER.value, server_default=UserRole.USER.value)
    status = db.Column(db.String(32), nullable=False, default=UserStatus.ACTIVE.value, server_default=UserStatus.ACTIVE.value)
    can_publish = db.Column(db.Boolean, nullable=False, default=True, server_default=db.true())
    can_comment = db.Column(db.Boolean, nullable=False, default=True, server_default=db.true())
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    last_login_at = db.Column(db.DateTime(timezone=True), nullable=True)

    refresh_sessions = db.relationship("RefreshSession", back_populates="user", cascade="all, delete-orphan")

    @property
    def is_login_allowed(self):
        return self.status == UserStatus.ACTIVE.value

    def set_password(self, raw_password):
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password):
        return check_password_hash(self.password_hash, raw_password)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "nickname": self.nickname,
            "avatar_url": self.avatar_url,
            "bio": self.bio,
            "region": self.region,
            "role": self.role,
            "status": self.status,
            "can_publish": self.can_publish,
            "can_comment": self.can_comment,
            "created_at": serialize_datetime(self.created_at),
            "updated_at": serialize_datetime(self.updated_at),
            "last_login_at": serialize_datetime(self.last_login_at),
        }
