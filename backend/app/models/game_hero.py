from datetime import datetime, timezone

from app.extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class GameHero(db.Model):
    __tablename__ = "game_heroes"
    __table_args__ = (
        db.UniqueConstraint("game_id", "normalized_name", name="uq_game_heroes_game_normalized_name"),
        db.UniqueConstraint("game_id", "slug", name="uq_game_heroes_game_slug"),
        db.CheckConstraint("status IN ('active', 'inactive')", name="ck_game_heroes_status"),
        db.CheckConstraint("review_status IN ('approved', 'pending', 'rejected')", name="ck_game_heroes_review_status"),
        db.Index("ix_game_heroes_game_status", "game_id", "status", "review_status"),
    )

    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey("games.id", ondelete="RESTRICT"), nullable=False, index=True)
    name_zh = db.Column(db.String(100), nullable=False)
    name_en = db.Column(db.String(120), nullable=True)
    normalized_name = db.Column(db.String(180), nullable=False, index=True)
    search_text = db.Column(db.String(800), nullable=False)
    slug = db.Column(db.String(140), nullable=False)
    aliases = db.Column(db.JSON, nullable=False, default=list)
    avatar_media_id = db.Column(db.Integer, db.ForeignKey("media.id", ondelete="SET NULL"), nullable=True)
    role = db.Column(db.String(80), nullable=True)
    description = db.Column(db.String(2000), nullable=True)
    status = db.Column(db.String(20), nullable=False, default="active", server_default="active")
    review_status = db.Column(db.String(20), nullable=False, default="approved", server_default="approved")
    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, index=True)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    game = db.relationship("Game", back_populates="heroes")
    creator = db.relationship("User", foreign_keys=[created_by_id])
    avatar_media = db.relationship("Media", foreign_keys=[avatar_media_id])
