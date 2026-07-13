from datetime import datetime, timezone

from app.extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class ContentDraft(db.Model):
    __tablename__ = "content_drafts"
    __table_args__ = (
        db.CheckConstraint("draft_type IN ('life_post', 'game_guide')", name="ck_content_drafts_type"),
        db.Index("ix_content_drafts_owner_updated", "owner_id", "updated_at"),
        db.Index("ix_content_drafts_owner_type_updated", "owner_id", "draft_type", "updated_at"),
    )

    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    draft_type = db.Column(db.String(30), nullable=False)
    title_cache = db.Column(db.String(120))
    payload = db.Column(db.JSON, nullable=False, default=dict)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    owner = db.relationship("User", foreign_keys=[owner_id])
    media_links = db.relationship(
        "ContentDraftMedia",
        back_populates="draft",
        cascade="all, delete-orphan",
        order_by="ContentDraftMedia.position",
    )
