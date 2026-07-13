from app.auth.service import utcnow
from app.extensions import db
from app.models import Notification, Report


def report_result_notification(report, message=None):
    payload = {"report_id": report.id, "target_type": report.target_type, "target_id": report.target_id, "result": report.status, "message": message or report.resolution_message or "举报已处理。"}
    db.session.add(Notification(recipient_id=report.reporter_id, notification_type="report_result", payload=payload, dedupe_key=f"report-result:{report.id}:{report.status}"))


def close_open_reports_for_target(target_type, target_id, message="相关内容已不可用，举报已结束。"):
    reports = db.session.scalars(db.select(Report).where(Report.target_type == target_type, Report.target_id == target_id, Report.status.in_(("pending", "in_progress")))).all()
    for report in reports:
        report.status, report.active_key, report.resolution_action, report.resolution_message, report.handled_at, report.updated_at = "resolved", None, "target_removed", message, utcnow(), utcnow()
        report_result_notification(report, message)
    return reports
