from datetime import timedelta
from flask import current_app
from sqlalchemy.exc import IntegrityError

from app.auth.service import utcnow
from app.extensions import db
from app.models import Report
from app.moderation.targets import serialize_target_snapshot

REASONS = {"inappropriate", "violence_illegal", "harassment", "spam", "plagiarism", "incorrect_tutorial", "duplicate", "other"}


def create_report(reporter, target_type, target, reason, description):
    since = utcnow() - timedelta(days=1)
    count = db.session.scalar(db.select(db.func.count(Report.id)).where(Report.reporter_id == reporter.id, Report.created_at >= since)) or 0
    if count >= current_app.config["REPORT_DAILY_LIMIT"]:
        return None, "limit"
    key = f"{reporter.id}:{target_type}:{target.id}"
    existing = db.session.scalar(db.select(Report).where(Report.active_key == key))
    if existing:
        return existing, "duplicate"
    report = Report(reporter_id=reporter.id, target_type=target_type, target_id=target.id, reason=reason, description=description, active_key=key, target_snapshot=serialize_target_snapshot(target_type, target))
    try:
        db.session.add(report); db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return db.session.scalar(db.select(Report).where(Report.active_key == key)), "duplicate"
    return report, None
