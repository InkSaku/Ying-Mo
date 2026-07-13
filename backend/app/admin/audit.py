import json
from flask import request

from app.extensions import db
from app.models import AdminLog

SENSITIVE = {"password", "password_hash", "token", "access_token", "refresh_token", "jwt", "authorization", "database_url", "secret_key"}


def sanitize_audit_data(value, depth=0):
    if depth > 4: return "[truncated]"
    if isinstance(value, dict): return {str(k)[:100]: "[redacted]" if str(k).lower() in SENSITIVE else sanitize_audit_data(v, depth + 1) for k, v in value.items()}
    if isinstance(value, (list, tuple)): return [sanitize_audit_data(item, depth + 1) for item in value[:50]]
    if isinstance(value, str): return value[:2000]
    return value if isinstance(value, (int, float, bool, type(None))) else str(value)[:2000]


def create_admin_log(admin, action, target_type, target_id=None, target_label=None, before=None, after=None, metadata=None):
    payload = {"before": sanitize_audit_data(before), "after": sanitize_audit_data(after), "metadata": sanitize_audit_data(metadata)}
    if len(json.dumps(payload, ensure_ascii=False, default=str)) > 16000:
        payload = {key: "[truncated]" if value else value for key, value in payload.items()}
    db.session.add(AdminLog(admin_id=admin.id, admin_role=admin.role, action=action, target_type=target_type, target_id=target_id, target_label=(target_label or "")[:255] or None, before_data=payload["before"], after_data=payload["after"], metadata_json=payload["metadata"], ip_address=(request.remote_addr or "")[:64] or None, user_agent=(request.user_agent.string or "")[:512] or None))
