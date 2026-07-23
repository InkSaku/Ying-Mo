from datetime import datetime, timezone

from app.extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class Game(db.Model):
    __tablename__ = "games"
    __table_args__ = (
        db.UniqueConstraint("normalized_name", name="uq_games_normalized_name"),
        db.UniqueConstraint("slug", name="uq_games_slug"),
        db.CheckConstraint("status IN ('active', 'inactive')", name="ck_games_status"),
        db.Index("ix_games_status_created", "status", "created_at"),
    )

    id = db.Column(db.Integer, primary_key=True)
    name_zh = db.Column(db.String(100), nullable=False)
    name_en = db.Column(db.String(120), nullable=True)
    normalized_name = db.Column(db.String(180), nullable=False, index=True)
    search_text = db.Column(db.String(800), nullable=False)
    slug = db.Column(db.String(140), nullable=False, index=True)
    aliases = db.Column(db.JSON, nullable=False, default=list)
    icon_media_id = db.Column(db.Integer, db.ForeignKey("media.id", ondelete="SET NULL"), nullable=True)
    cover_media_id = db.Column(db.Integer, db.ForeignKey("media.id", ondelete="SET NULL"), nullable=True)
    description = db.Column(db.String(2000), nullable=True)
    current_version = db.Column(db.String(50), nullable=True)
    status = db.Column(db.String(20), nullable=False, default="inactive", server_default="inactive", index=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, index=True)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    creator = db.relationship("User", foreign_keys=[created_by_id])
    icon_media = db.relationship("Media", foreign_keys=[icon_media_id])
    cover_media = db.relationship("Media", foreign_keys=[cover_media_id])
    heroes = db.relationship("GameHero", back_populates="game", lazy="select")
    maps = db.relationship("GameMap", back_populates="game", lazy="select")
