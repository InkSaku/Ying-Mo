from app.extensions import db
from .user import utcnow


class FeaturedContent(db.Model):
    __tablename__ = "featured_content"
    __table_args__ = (
        db.CheckConstraint("target_type IN ('life_post', 'game_guide')", name="ck_featured_content_target_type"),
        db.UniqueConstraint("target_type", "target_id", name="uq_featured_content_target"),
        db.Index("ix_featured_content_created", "created_at"),
    )

    id = db.Column(db.Integer, primary_key=True)
    target_type = db.Column(db.String(30), nullable=False)
    target_id = db.Column(db.Integer, nullable=False)
    featured_by_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    note = db.Column(db.String(500))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    featured_by = db.relationship("User", foreign_keys=[featured_by_id])
