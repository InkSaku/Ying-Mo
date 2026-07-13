from app.extensions import db
from .content_like import utcnow


class Comment(db.Model):
    __tablename__ = "comments"
    __table_args__ = (
        db.CheckConstraint("target_type IN ('life_post', 'game_guide')", name="ck_comments_target_type"),
        db.CheckConstraint("status IN ('active', 'deleted', 'hidden')", name="ck_comments_status"),
        db.Index("ix_comments_target_created", "target_type", "target_id", "created_at"),
        db.Index("ix_comments_target_parent_created", "target_type", "target_id", "parent_id", "created_at"),
        db.Index("ix_comments_author_created", "author_id", "created_at"),
        db.Index("ix_comments_parent_created", "parent_id", "created_at"),
        db.Index("ix_comments_status_created", "status", "created_at"),
    )
    id = db.Column(db.Integer, primary_key=True)
    target_type = db.Column(db.String(30), nullable=False)
    target_id = db.Column(db.Integer, nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey("comments.id", ondelete="CASCADE"))
    reply_to_comment_id = db.Column(db.Integer, db.ForeignKey("comments.id", ondelete="SET NULL"))
    reply_to_user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    body = db.Column(db.String(500))
    status = db.Column(db.String(20), nullable=False, default="active", server_default="active")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    deleted_at = db.Column(db.DateTime(timezone=True))
    author = db.relationship("User", foreign_keys=[author_id])
    reply_to_user = db.relationship("User", foreign_keys=[reply_to_user_id])
    parent = db.relationship("Comment", remote_side=[id], foreign_keys=[parent_id])
    reply_to_comment = db.relationship("Comment", remote_side=[id], foreign_keys=[reply_to_comment_id])

