from datetime import datetime, timezone

from app.extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class GuideValidityFeedback(db.Model):
    __tablename__ = "guide_validity_feedback"
    __table_args__ = (
        db.CheckConstraint("feedback_type IN ('valid', 'possibly_invalid')", name="ck_guide_validity_feedback_type"),
        db.UniqueConstraint("guide_id", "user_id", name="uq_guide_validity_feedback_guide_user"),
        db.Index("ix_guide_validity_feedback_guide_type", "guide_id", "feedback_type"),
    )

    id = db.Column(db.Integer, primary_key=True)
    guide_id = db.Column(db.Integer, db.ForeignKey("game_guides.id", ondelete="CASCADE"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    feedback_type = db.Column(db.String(30), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    guide = db.relationship("GameGuide", back_populates="validity_feedback")
    user = db.relationship("User", foreign_keys=[user_id])
