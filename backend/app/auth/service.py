from datetime import datetime, timezone

from flask_jwt_extended import create_access_token, create_refresh_token, decode_token
from sqlalchemy import or_

from app.extensions import db
from app.models import RefreshSession, User


def utcnow():
    return datetime.now(timezone.utc)


def issue_session(user):
    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
    payload = decode_token(refresh_token)
    expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    db.session.add(RefreshSession(user_id=user.id, jti=payload["jti"], expires_at=expires_at))
    return access_token, refresh_token


def rotate_session(user, jti):
    session = db.session.scalar(db.select(RefreshSession).where(RefreshSession.jti == jti))
    if session is None or session.user_id != user.id or not session.is_active:
        return None
    session.revoke()
    return issue_session(user)


def revoke_session(user_id, jti):
    session = db.session.scalar(
        db.select(RefreshSession).where(RefreshSession.user_id == user_id, RefreshSession.jti == jti)
    )
    if session and session.revoked_at is None:
        session.revoke()
        db.session.commit()


def find_user(identifier):
    normalized = identifier.strip().lower()
    return db.session.scalar(
        db.select(User).where(
            or_(User.username_normalized == normalized, User.email_normalized == normalized)
        )
    )
