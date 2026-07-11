from datetime import datetime, timezone

from app.extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class LifePostMedia(db.Model):
    __tablename__ = "life_post_media"
    __table_args__ = (db.UniqueConstraint("post_id", "position", name="uq_life_post_media_position"),)

    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey("life_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    media_id = db.Column(db.Integer, db.ForeignKey("media.id", ondelete="RESTRICT"), nullable=False, unique=True)
    position = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    post = db.relationship("LifePost", back_populates="media_links")
    media = db.relationship("Media", backref=db.backref("life_post_link", uselist=False))
