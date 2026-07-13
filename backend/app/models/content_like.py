from datetime import datetime, timezone

from app.extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class ContentLike(db.Model):
    __tablename__ = "content_likes"
    __table_args__ = (
        db.CheckConstraint("target_type IN ('life_post', 'game_guide')", name="ck_content_likes_target_type"),
        db.UniqueConstraint("user_id", "target_type", "target_id", name="uq_content_likes_user_target"),
        db.Index("ix_content_likes_target", "target_type", "target_id"),
        db.Index("ix_content_likes_user_created", "user_id", "created_at"),
        db.Index("ix_content_likes_target_created", "target_type", "target_id", "created_at"),
    )
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_type = db.Column(db.String(30), nullable=False)
    target_id = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

