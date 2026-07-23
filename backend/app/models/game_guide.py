from datetime import datetime, timezone

from app.extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class GameGuide(db.Model):
    __tablename__ = "game_guides"
    __table_args__ = (
        db.CheckConstraint("guide_scope IN ('game', 'hero', 'map', 'hero_map')", name="ck_game_guides_scope"),
        db.CheckConstraint("category IN ('deployment_position', 'skill_throw', 'timed_throw', 'hold_position', 'movement_route', 'map_interaction', 'other')", name="ck_game_guides_category"),
        db.CheckConstraint("content_mode IN ('simple', 'steps')", name="ck_game_guides_content_mode"),
        db.CheckConstraint("side IN ('attack', 'defense', 'both') OR side IS NULL", name="ck_game_guides_side"),
        db.CheckConstraint("difficulty IN ('beginner', 'intermediate', 'advanced') OR difficulty IS NULL", name="ck_game_guides_difficulty"),
        db.CheckConstraint("validity_status IN ('unverified', 'valid', 'possibly_invalid', 'invalid')", name="ck_game_guides_validity"),
        db.CheckConstraint("status IN ('published', 'hidden')", name="ck_game_guides_status"),
        db.Index("ix_game_guides_game_created", "game_id", "created_at"),
        db.Index("ix_game_guides_hero_created", "hero_id", "created_at"),
        db.Index("ix_game_guides_map_created", "map_id", "created_at"),
        db.Index("ix_game_guides_game_map_hero_updated", "game_id", "map_id", "hero_id", "updated_at"),
        db.Index("ix_game_guides_author_created", "author_id", "created_at"),
        db.Index("ix_game_guides_status_created", "status", "created_at"),
    )

    id = db.Column(db.Integer, primary_key=True)
    author_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    game_id = db.Column(db.Integer, db.ForeignKey("games.id", ondelete="RESTRICT"), nullable=False)
    hero_id = db.Column(db.Integer, db.ForeignKey("game_heroes.id", ondelete="RESTRICT"), nullable=True)
    map_id = db.Column(db.Integer, db.ForeignKey("game_maps.id", ondelete="RESTRICT"), nullable=True)
    guide_scope = db.Column(db.String(20), nullable=False)
    content_mode = db.Column(db.String(16), nullable=False, default="simple", server_default="simple")
    title = db.Column(db.String(120), nullable=False)
    category = db.Column(db.String(40), nullable=False)
    instructions = db.Column(db.Text, nullable=False)
    map_area = db.Column(db.String(120))
    side = db.Column(db.String(20))
    skill = db.Column(db.String(120))
    aim_reference = db.Column(db.String(500))
    timing = db.Column(db.String(500))
    difficulty = db.Column(db.String(20))
    game_version = db.Column(db.String(50))
    tags = db.Column(db.JSON, nullable=False, default=list)
    notes = db.Column(db.Text)
    video_url = db.Column(db.String(1000))
    search_text = db.Column(db.Text, nullable=False)
    validity_status = db.Column(db.String(30), nullable=False, default="unverified", server_default="unverified", index=True)
    tested_at = db.Column(db.Date)
    validity_note = db.Column(db.String(1000))
    last_confirmed_at = db.Column(db.DateTime(timezone=True))
    status = db.Column(db.String(20), nullable=False, default="published", server_default="published")
    moderation_reason = db.Column(db.String(1000))
    hidden_at = db.Column(db.DateTime(timezone=True))
    hidden_by_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    author = db.relationship("User", foreign_keys=[author_id])
    game = db.relationship("Game", foreign_keys=[game_id])
    hero = db.relationship("GameHero", foreign_keys=[hero_id])
    game_map = db.relationship("GameMap", foreign_keys=[map_id])
    steps = db.relationship("GameGuideStep", back_populates="guide", cascade="all, delete-orphan", order_by="GameGuideStep.position")
    validity_feedback = db.relationship("GuideValidityFeedback", back_populates="guide", cascade="all, delete-orphan")
    hidden_by = db.relationship("User", foreign_keys=[hidden_by_id])
