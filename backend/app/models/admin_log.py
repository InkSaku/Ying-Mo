from app.extensions import db
from .user import utcnow


class AdminLog(db.Model):
    __tablename__ = "admin_logs"
    __table_args__ = (
        db.Index("ix_admin_logs_admin_created", "admin_id", "created_at"),
        db.Index("ix_admin_logs_target", "target_type", "target_id"),
        db.Index("ix_admin_logs_action_created", "action", "created_at"),
        db.UniqueConstraint("idempotency_key", name="uq_admin_logs_idempotency_key"),
    )

    id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"))
    admin_role = db.Column(db.String(32), nullable=False)
    action = db.Column(db.String(80), nullable=False)
    target_type = db.Column(db.String(30), nullable=False)
    target_id = db.Column(db.Integer)
    target_label = db.Column(db.String(255))
    before_data = db.Column(db.JSON)
    after_data = db.Column(db.JSON)
    metadata_json = db.Column("metadata", db.JSON)
    ip_address = db.Column(db.String(64))
    user_agent = db.Column(db.String(512))
    idempotency_key = db.Column(db.String(36))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    admin = db.relationship("User", foreign_keys=[admin_id])
