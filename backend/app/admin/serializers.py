from app.models.user import serialize_datetime
from app.users.service import public_user_dict


def admin_user_dict(user):
    return {**user.to_dict(), "public": public_user_dict(user)}


def admin_log_dict(item):
    return {"id": item.id, "admin": public_user_dict(item.admin) if item.admin else None, "admin_role": item.admin_role, "action": item.action, "target_type": item.target_type, "target_id": item.target_id, "target_label": item.target_label, "before_data": item.before_data, "after_data": item.after_data, "metadata": item.metadata_json, "ip_address": item.ip_address, "user_agent": (item.user_agent or "")[:160] or None, "created_at": serialize_datetime(item.created_at)}
