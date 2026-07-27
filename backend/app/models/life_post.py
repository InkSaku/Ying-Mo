from datetime import datetime, timezone

from app.extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class LifePost(db.Model):
    __tablename__ = "life_posts"
    __table_args__ = (
        db.CheckConstraint(
            "content_format IN ('plain', 'markdown')",
            name="ck_life_posts_content_format",
        ),
        db.Index("ix_life_posts_chapter_created", "chapter_id", "created_at"),
        db.Index("ix_life_posts_author_created", "author_id", "created_at"),
        db.Index("ix_life_posts_visibility_created", "visibility", "created_at"),
        db.Index("ix_life_posts_status_created", "status", "created_at"),
    )

    id = db.Column(db.Integer, primary_key=True)
    author_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    chapter_id = db.Column(db.Integer, db.ForeignKey("life_chapters.id", ondelete="RESTRICT"), nullable=False)
    title = db.Column(db.String(100), nullable=True)
    body = db.Column(db.Text, nullable=True)
    content_format = db.Column(
        db.String(20),
        nullable=False,
        default="plain",
        server_default="plain",
    )
    external_video_url = db.Column(db.String(2048), nullable=True)
    cover_media_id = db.Column(
        db.Integer,
        db.ForeignKey("media.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    location = db.Column(db.String(100), nullable=True)
    mood = db.Column(db.String(30), nullable=True)
    tags = db.Column(db.JSON, nullable=False, default=list)
    shot_at = db.Column(db.DateTime(timezone=True), nullable=True)
    visibility = db.Column(db.String(20), nullable=False, default="public", server_default="public")
    status = db.Column(db.String(20), nullable=False, default="published", server_default="published")
    moderation_reason = db.Column(db.String(1000))
    hidden_at = db.Column(db.DateTime(timezone=True))
    hidden_by_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    author = db.relationship("User", foreign_keys=[author_id], backref=db.backref("life_posts", lazy="dynamic"))
    chapter = db.relationship("LifeChapter", backref=db.backref("posts", lazy="dynamic"))
    cover_media = db.relationship("Media", foreign_keys=[cover_media_id])
    media_links = db.relationship("LifePostMedia", back_populates="post", cascade="all, delete-orphan", order_by="LifePostMedia.position")
    hidden_by = db.relationship("User", foreign_keys=[hidden_by_id])
