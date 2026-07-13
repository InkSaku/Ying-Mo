from flask import request
from flask_jwt_extended import jwt_required

from app.auth.routes import _current_user
from app.common.responses import error_response, success_response
from app.models import UserStatus
from app.moderation.targets import REPORT_TARGET_TYPES, resolve_report_target
from . import reports_bp
from .serializers import report_dict
from .service import REASONS, create_report


@reports_bp.post("")
@jwt_required(locations=["headers"])
def create():
    user = _current_user()
    if not user or user.status != UserStatus.ACTIVE.value:
        return error_response("ACCOUNT_RESTRICTED", "当前账号无法继续使用。", 403)
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return error_response("VALIDATION_ERROR", "请求体必须是 JSON 对象。", 422)
    target_type, target_id, reason = payload.get("target_type"), payload.get("target_id"), payload.get("reason")
    description = payload.get("description", "")
    if not isinstance(description, str) or len(description.strip()) > 1000:
        return error_response("VALIDATION_ERROR", "举报说明最多 1000 个字符。", 422)
    description = description.strip() or None
    if target_type not in REPORT_TARGET_TYPES or not isinstance(target_id, int) or isinstance(target_id, bool) or target_id <= 0 or reason not in REASONS or (reason == "other" and not description):
        return error_response("VALIDATION_ERROR", "举报对象、原因或说明不合法。", 422)
    target = resolve_report_target(target_type, target_id, user)
    if not target:
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    report, state = create_report(user, target_type, target, reason, description)
    if state == "limit":
        return error_response("RATE_LIMITED", "今日举报次数已达上限。", 429)
    data = report_dict(report)
    data["already_exists"] = state == "duplicate"
    return success_response(data, 200 if state == "duplicate" else 201)
