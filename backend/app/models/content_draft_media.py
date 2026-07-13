from datetime import datetime, timezone

from app.extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class ContentDraftMedia(db.Model):
    __tablename__ = "content_draft_media"
    __table_args__ = (
        db.UniqueConstraint("media_id", name="uq_content_draft_media_media"),
        db.UniqueConstraint("draft_id", "position", name="uq_content_draft_media_position"),
        db.CheckConstraint("position >= 0", name="ck_content_draft_media_position"),
    )

    id = db.Column(db.Integer, primary_key=True)
    draft_id = db.Column(db.Integer, db.ForeignKey("content_drafts.id", ondelete="CASCADE"), nullable=False)
    media_id = db.Column(db.Integer, db.ForeignKey("media.id", ondelete="RESTRICT"), nullable=False)
    position = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    draft = db.relationship("ContentDraft", back_populates="media_links")
    media = db.relationship("Media")
