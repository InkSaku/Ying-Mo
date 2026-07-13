from datetime import datetime, timezone

from app.extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class GameGuideStep(db.Model):
    __tablename__ = "game_guide_steps"
    __table_args__ = (
        db.UniqueConstraint("media_id", name="uq_game_guide_steps_media"),
        db.UniqueConstraint("guide_id", "position", name="uq_game_guide_steps_position"),
        db.CheckConstraint("position >= 0", name="ck_game_guide_steps_position"),
    )

    id = db.Column(db.Integer, primary_key=True)
    guide_id = db.Column(db.Integer, db.ForeignKey("game_guides.id", ondelete="CASCADE"), nullable=False, index=True)
    media_id = db.Column(db.Integer, db.ForeignKey("media.id", ondelete="RESTRICT"), nullable=False)
    position = db.Column(db.Integer, nullable=False)
    title = db.Column(db.String(120), nullable=False)
    description = db.Column(db.String(3000), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    guide = db.relationship("GameGuide", back_populates="steps")
    media = db.relationship("Media", foreign_keys=[media_id])
