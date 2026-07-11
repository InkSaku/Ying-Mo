from datetime import datetime, timezone
import uuid

from app.extensions import db
from .user import serialize_datetime


def utcnow():
    return datetime.now(timezone.utc)


class MediaPurpose:
    AVATAR = "avatar"
    CONTENT = "content"

    ALL = (AVATAR, CONTENT)


class Media(db.Model):
    __tablename__ = "media"
    __table_args__ = (
        db.CheckConstraint("purpose IN ('avatar', 'content')", name="ck_media_purpose"),
        db.Index("ix_media_bound_type_bound_id", "bound_type", "bound_id"),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    public_id = db.Column(db.String(36), nullable=False, unique=True, index=True, default=lambda: str(uuid.uuid4()))
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    purpose = db.Column(db.String(20), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    storage_key = db.Column(db.String(512), nullable=False)
    thumbnail_key = db.Column(db.String(512), nullable=False)
    mime_type = db.Column(db.String(100), nullable=False)
    size_bytes = db.Column(db.Integer, nullable=False)
    width = db.Column(db.Integer, nullable=False)
    height = db.Column(db.Integer, nullable=False)
    bound_type = db.Column(db.String(50), nullable=True)
    bound_id = db.Column(db.Integer, nullable=True)
    bound_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    owner = db.relationship("User", backref=db.backref("media", cascade="all, delete-orphan"))

    @property
    def is_bound(self):
        return self.bound_type is not None

    def to_dict(self):
        return {
            "id": self.id,
            "public_id": self.public_id,
            "purpose": self.purpose,
            "url": f"/api/v1/uploads/images/{self.public_id}",
            "thumbnail_url": f"/api/v1/uploads/images/{self.public_id}/thumbnail",
            "mime_type": self.mime_type,
            "size_bytes": self.size_bytes,
            "width": self.width,
            "height": self.height,
            "is_bound": self.is_bound,
            "created_at": serialize_datetime(self.created_at),
        }
