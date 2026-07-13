from datetime import datetime, timezone

from app.extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class GameMap(db.Model):
    __tablename__ = "game_maps"
    __table_args__ = (
        db.UniqueConstraint("game_id", "normalized_name", name="uq_game_maps_game_normalized_name"),
        db.UniqueConstraint("game_id", "slug", name="uq_game_maps_game_slug"),
        db.CheckConstraint("current_status IN ('active', 'rotated_out', 'retired')", name="ck_game_maps_current_status"),
        db.CheckConstraint("review_status IN ('approved', 'pending', 'rejected')", name="ck_game_maps_review_status"),
        db.Index("ix_game_maps_game_review", "game_id", "review_status"),
    )

    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, db.ForeignKey("games.id", ondelete="RESTRICT"), nullable=False, index=True)
    name_zh = db.Column(db.String(100), nullable=False)
    name_en = db.Column(db.String(120), nullable=True)
    normalized_name = db.Column(db.String(180), nullable=False, index=True)
    search_text = db.Column(db.String(800), nullable=False)
    slug = db.Column(db.String(140), nullable=False)
    aliases = db.Column(db.JSON, nullable=False, default=list)
    map_type = db.Column(db.String(80), nullable=True)
    cover_media_id = db.Column(db.Integer, db.ForeignKey("media.id", ondelete="SET NULL"), nullable=True)
    description = db.Column(db.String(2000), nullable=True)
    current_status = db.Column(db.String(20), nullable=False, default="active", server_default="active")
    review_status = db.Column(db.String(20), nullable=False, default="approved", server_default="approved")
    created_by_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, index=True)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    game = db.relationship("Game", back_populates="maps")
    creator = db.relationship("User", foreign_keys=[created_by_id])
    cover_media = db.relationship("Media", foreign_keys=[cover_media_id])
