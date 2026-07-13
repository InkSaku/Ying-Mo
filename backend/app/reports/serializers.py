from app.models.user import serialize_datetime
from app.users.service import public_user_dict


def report_dict(report, detail=False):
    data = {"id": report.id, "target_type": report.target_type, "target_id": report.target_id, "reason": report.reason, "status": report.status, "assigned_to": public_user_dict(report.assigned_to) if report.assigned_to else None, "created_at": serialize_datetime(report.created_at), "updated_at": serialize_datetime(report.updated_at)}
    if detail:
        data.update({"reporter": public_user_dict(report.reporter), "description": report.description, "target_snapshot": report.target_snapshot, "handled_by": public_user_dict(report.handled_by) if report.handled_by else None, "resolution_action": report.resolution_action, "resolution_message": report.resolution_message, "handled_at": serialize_datetime(report.handled_at)})
    return data
