from app.extensions import db
from .content_like import utcnow


class Notification(db.Model):
    __tablename__ = "notifications"
    __table_args__ = (
        db.CheckConstraint("notification_type IN ('like','comment','reply','chapter_review','content_hidden','report_result','system')", name="ck_notifications_type"),
        db.CheckConstraint("target_type IS NULL OR target_type IN ('life_post', 'game_guide')", name="ck_notifications_target_type"),
        db.Index("ix_notifications_recipient_created", "recipient_id", "created_at"),
        db.Index("ix_notifications_recipient_read_created", "recipient_id", "read_at", "created_at"),
        db.Index("ix_notifications_target", "target_type", "target_id"),
        db.Index("ix_notifications_comment", "comment_id"),
    )
    id = db.Column(db.Integer, primary_key=True)
    recipient_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    actor_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    notification_type = db.Column(db.String(30), nullable=False)
    target_type = db.Column(db.String(30))
    target_id = db.Column(db.Integer)
    comment_id = db.Column(db.Integer, db.ForeignKey("comments.id", ondelete="SET NULL"))
    dedupe_key = db.Column(db.String(255), unique=True)
    payload = db.Column(db.JSON, nullable=False, default=dict)
    read_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    actor = db.relationship("User", foreign_keys=[actor_id])

