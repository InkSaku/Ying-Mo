from datetime import datetime, timezone

from app.extensions import db
from .user import serialize_datetime


def utcnow():
    return datetime.now(timezone.utc)


class LifeChapter(db.Model):
    __tablename__ = "life_chapters"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    normalized_name = db.Column(db.String(160), nullable=False, index=True)
    dedupe_key = db.Column(db.String(220), nullable=False, unique=True, index=True)
    slug = db.Column(db.String(120), nullable=False, unique=True, index=True)
    chapter_type = db.Column(db.String(20), nullable=False, index=True)
    parent_id = db.Column(db.Integer, db.ForeignKey("life_chapters.id", ondelete="RESTRICT"), nullable=True, index=True)
    country = db.Column(db.String(100), nullable=True)
    province = db.Column(db.String(100), nullable=True)
    city = db.Column(db.String(100), nullable=True)
    description = db.Column(db.String(500), nullable=True)
    cover_media_id = db.Column(db.Integer, db.ForeignKey("media.id", ondelete="SET NULL"), nullable=True)
    creator_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    status = db.Column(db.String(20), nullable=False, default="active", server_default="active", index=True)
    aliases = db.Column(db.JSON, nullable=False, default=list)
    review_status = db.Column(db.String(20), nullable=False, default="approved", server_default="approved", index=True)
    review_note = db.Column(db.String(1000))
    reviewed_by_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    reviewed_at = db.Column(db.DateTime(timezone=True))
    merged_into_id = db.Column(db.Integer, db.ForeignKey("life_chapters.id", ondelete="SET NULL"))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    parent = db.relationship("LifeChapter", remote_side=[id], foreign_keys=[parent_id], backref=db.backref("children", lazy="select"))
    creator = db.relationship("User", foreign_keys=[creator_id], backref=db.backref("life_chapters", lazy="dynamic"))
    cover_media = db.relationship("Media", foreign_keys=[cover_media_id])
    reviewed_by = db.relationship("User", foreign_keys=[reviewed_by_id])
    merged_into = db.relationship("LifeChapter", remote_side=[id], foreign_keys=[merged_into_id])
