from app.extensions import db
from .user import utcnow


class Report(db.Model):
    __tablename__ = "reports"
    __table_args__ = (
        db.CheckConstraint("target_type IN ('life_post', 'game_guide', 'comment', 'user')", name="ck_reports_target_type"),
        db.CheckConstraint("reason IN ('inappropriate', 'violence_illegal', 'harassment', 'spam', 'plagiarism', 'incorrect_tutorial', 'guide_outdated', 'wrong_map_or_hero', 'duplicate', 'other')", name="ck_reports_reason"),
        db.CheckConstraint("status IN ('pending', 'in_progress', 'resolved', 'rejected')", name="ck_reports_status"),
        db.Index("ix_reports_reporter_created", "reporter_id", "created_at"),
        db.Index("ix_reports_target", "target_type", "target_id"),
        db.Index("ix_reports_status_created", "status", "created_at"),
        db.Index("ix_reports_assigned_status_updated", "assigned_to_id", "status", "updated_at"),
        db.Index("ix_reports_reason_status", "reason", "status"),
    )

    id = db.Column(db.Integer, primary_key=True)
    reporter_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    target_type = db.Column(db.String(30), nullable=False)
    target_id = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(40), nullable=False)
    description = db.Column(db.String(1000))
    status = db.Column(db.String(20), nullable=False, default="pending", server_default="pending")
    review_round = db.Column(db.Integer, nullable=False, default=1, server_default="1")
    active_key = db.Column(db.String(255), unique=True)
    assigned_to_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    handled_by_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    resolution_action = db.Column(db.String(50))
    resolution_message = db.Column(db.String(1000))
    internal_note = db.Column(db.Text)
    target_snapshot = db.Column(db.JSON, nullable=False, default=dict)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    handled_at = db.Column(db.DateTime(timezone=True))

    reporter = db.relationship("User", foreign_keys=[reporter_id])
    assigned_to = db.relationship("User", foreign_keys=[assigned_to_id])
    handled_by = db.relationship("User", foreign_keys=[handled_by_id])
