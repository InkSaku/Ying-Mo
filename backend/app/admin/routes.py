from datetime import datetime, timezone
import uuid

from flask import current_app, g, request
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload, selectinload

from app.auth.service import revoke_session, utcnow
from app.common.responses import error_response, success_response
from app.extensions import db
from app.guides.routes import GUIDE_OPTIONS
from app.guides.serializers import guide_dict
from app.guides.service import remove_files
from app.interactions.targets import cleanup_target_interactions
from app.life.chapter_serializers import managed_chapter_dict
from app.life.chapter_service import (
    ChapterOperationError,
    delete_or_merge_chapter,
    force_delete_chapter as force_delete_chapter_service,
    preview_chapter_deletion,
    update_chapter as update_chapter_service,
)
from app.life.routes import CHAPTER_OPTIONS, POST_OPTIONS, chapter_slug, chapter_stats, normalize_name, post_dict
from app.models import AdminLog, Comment, FeaturedContent, Game, GameGuide, GameGuideStep, GameHero, GameMap, GuideValidityFeedback, LifeChapter, LifePost, LifePostMedia, Media, Notification, RefreshSession, Report, User, UserRole, UserStatus
from app.models.user import serialize_datetime
from app.moderation.service import close_open_reports_for_target, report_result_notification
from app.moderation.targets import CONTENT_TARGET_TYPES, resolve_admin_target, serialize_target_snapshot, target_author_id
from app.notifications.service import create_like_notification
from app.uploads.storage import remove_media_files
from app.users.service import public_user_dict
from . import admin_bp
from .audit import create_admin_log
from .permissions import can_manage_user, is_system_admin, require_content_admin, require_system_admin
from .serializers import admin_log_dict, admin_user_dict


REPORT_ACTIONS = {
    "life_post": {"no_action", "hide_content", "delete_content", "restrict_publish", "ban_user"},
    "game_guide": {"no_action", "hide_content", "delete_content", "mark_guide_invalid", "restrict_publish", "ban_user"},
    "comment": {"no_action", "hide_comment", "delete_comment", "restrict_comment", "ban_user"},
    "user": {"no_action", "restrict_publish", "restrict_comment", "ban_user"},
}


def _page():
    try: page, size = int(request.args.get("page", 1)), int(request.args.get("page_size", 20))
    except ValueError: return None
    return (page, size) if page >= 1 and 1 <= size <= 100 else None


def _meta(page, size, total): return {"pagination": {"page": page, "page_size": size, "total": total, "total_pages": (total + size - 1) // size, "has_next": page * size < total, "has_previous": page > 1}}
def _validation(message): return error_response("VALIDATION_ERROR", message, 422)
def _not_found(): return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
def _chapter_error(error):
    db.session.rollback()
    return error_response(error.code, error.message, error.status, error.details)
def _commit(message="操作保存失败。"):
    try: db.session.commit(); return None
    except Exception:
        db.session.rollback(); current_app.logger.exception(message); return error_response("INTERNAL_ERROR", message, 500)
def _reason(data):
    value = data.get("reason") if isinstance(data, dict) else None
    return value.strip() if isinstance(value, str) and 1 <= len(value.strip()) <= 1000 else None
def _confirmed(data, expected): return isinstance(data, dict) and data.get("confirmation") == expected
def _idempotency(actor):
    value = request.headers.get("Idempotency-Key", "")
    try: normalized = str(uuid.UUID(value))
    except (ValueError, AttributeError): return None, None, _validation("高风险操作需要有效的 Idempotency-Key UUID。")
    existing = db.session.scalar(
        db.select(AdminLog).where(AdminLog.idempotency_key == normalized)
    )
    g.admin_idempotency_key = normalized
    return normalized, existing, None
def _notify(recipient_id, kind, payload, actor=None, target_type=None, target_id=None, key=None):
    if recipient_id and (not actor or recipient_id != actor.id): db.session.add(Notification(recipient_id=recipient_id, actor_id=actor.id if actor else None, notification_type=kind, target_type=target_type, target_id=target_id, payload=payload, dedupe_key=key))


def _content_options(kind): return POST_OPTIONS if kind == "life_post" else GUIDE_OPTIONS
def _content_model(kind): return LifePost if kind == "life_post" else GameGuide
def _content_label(kind, item): return item.title
def _content_data(kind, item, actor): return post_dict(item, actor, True) if kind == "life_post" else guide_dict(item, actor, True)
def _remove_feature(kind, target_id): db.session.execute(db.delete(FeaturedContent).where(FeaturedContent.target_type == kind, FeaturedContent.target_id == target_id))
def _content_state(item): return {"status": item.status, "moderation_reason": item.moderation_reason, "hidden_at": serialize_datetime(item.hidden_at), "hidden_by_id": item.hidden_by_id}


def _soft_delete_comment(item):
    item.body, item.status, item.deleted_at, item.updated_at = None, "deleted", utcnow(), utcnow()
    db.session.execute(db.delete(Notification).where(Notification.comment_id == item.id))
    close_open_reports_for_target("comment", item.id)


def _delete_content(kind, item, actor, action="content_deleted", reason=None):
    media = [link.media for link in item.media_links] if kind == "life_post" else [step.media for step in item.steps]
    before = _content_state(item)
    _remove_feature(kind, item.id); close_open_reports_for_target(kind, item.id)
    cleanup_target_interactions(kind, item.id)
    if kind == "game_guide":
        for step in list(item.steps): db.session.delete(step)
        db.session.flush()
    db.session.delete(item); db.session.flush()
    for file in media: db.session.delete(file)
    _notify(item.author_id, "content_hidden", {"action": "deleted", "target_type": kind, "target_id": item.id, "message": "你的内容已被管理员删除。"}, actor)
    create_admin_log(actor, action, kind, item.id, _content_label(kind, item), before, {"status": "deleted"}, {"reason": reason})
    return media


@admin_bp.get("/summary")
@require_content_admin()
def summary(actor):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    count = lambda model, *where: db.session.scalar(db.select(func.count(model.id)).where(*where)) or 0
    return success_response({"pending_report_count": count(Report, Report.status == "pending"), "in_progress_report_count": count(Report, Report.status == "in_progress"), "pending_chapter_count": count(LifeChapter, LifeChapter.review_status == "pending"), "hidden_life_post_count": count(LifePost, LifePost.status == "hidden"), "hidden_guide_count": count(GameGuide, GameGuide.status == "hidden"), "active_user_count": count(User, User.status == UserStatus.ACTIVE.value), "today_report_count": count(Report, Report.created_at >= today), "today_admin_action_count": count(AdminLog, AdminLog.created_at >= today)})


@admin_bp.get("/reports")
@require_content_admin()
def reports(actor):
    args = _page()
    if not args: return _validation("分页参数不合法。")
    page, size = args; stmt = db.select(Report).options(joinedload(Report.reporter), joinedload(Report.assigned_to), joinedload(Report.handled_by))
    for field, choices in (("status", {"pending", "in_progress", "resolved", "rejected"}), ("target_type", {"life_post", "game_guide", "comment", "user"}), ("reason", {"inappropriate", "violence_illegal", "harassment", "spam", "plagiarism", "incorrect_tutorial", "duplicate", "other"})):
        value = request.args.get(field)
        if value:
            if value not in choices: return _validation("筛选条件不合法。")
            stmt = stmt.where(getattr(Report, field) == value)
    if request.args.get("assigned_to"):
        try: stmt = stmt.where(Report.assigned_to_id == int(request.args["assigned_to"]))
        except ValueError: return _validation("处理人不合法。")
    query = request.args.get("query", "").strip()
    if query: stmt = stmt.where(or_(Report.description.ilike(f"%{query.replace('%', '\\%').replace('_', '\\_')}%"), Report.target_snapshot.cast(db.String).ilike(f"%{query.replace('%', '\\%').replace('_', '\\_')}%")))
    total = db.session.scalar(db.select(func.count()).select_from(stmt.subquery()))
    items = db.session.scalars(stmt.order_by(Report.updated_at.desc(), Report.id.desc()).offset((page - 1) * size).limit(size)).all()
    from app.reports.serializers import report_dict
    return success_response([report_dict(item) for item in items], meta=_meta(page, size, total))


@admin_bp.get("/reports/<int:report_id>")
@require_content_admin()
def report_detail(actor, report_id):
    item = db.session.scalar(db.select(Report).where(Report.id == report_id).options(joinedload(Report.reporter), joinedload(Report.assigned_to), joinedload(Report.handled_by)))
    if not item: return _not_found()
    target = resolve_admin_target(item.target_type, item.target_id, actor)
    from app.reports.serializers import report_dict
    data = report_dict(item, True)
    data.update({"current_target": serialize_target_snapshot(item.target_type, target) if target else None, "target_exists": bool(target), "internal_note": item.internal_note, "allowed_actions": sorted(REPORT_ACTIONS[item.target_type] - ({"ban_user"} if not is_system_admin(actor) else set()))})
    return success_response(data)


def _report_get(report_id):
    return db.session.scalar(db.select(Report).where(Report.id == report_id).with_for_update())


@admin_bp.post("/reports/<int:report_id>/claim")
@require_content_admin()
def claim(actor, report_id):
    item = _report_get(report_id)
    if not item: return _not_found()
    if item.status != "pending": return error_response("RESOURCE_CONFLICT", "该举报已被领取或已结束。", 409)
    item.status, item.assigned_to_id, item.updated_at = "in_progress", actor.id, utcnow(); create_admin_log(actor, "report_claimed", "report", item.id, f"举报 #{item.id}", {"status": "pending"}, {"status": "in_progress", "assigned_to_id": actor.id})
    error = _commit(); return error or success_response({"id": item.id, "status": item.status})


@admin_bp.post("/reports/<int:report_id>/release")
@require_content_admin()
def release(actor, report_id):
    item = _report_get(report_id)
    if not item: return _not_found()
    if item.status != "in_progress" or (item.assigned_to_id != actor.id and not is_system_admin(actor)): return error_response("PERMISSION_DENIED", "无权释放该举报。", 403)
    item.status, item.assigned_to_id, item.updated_at = "pending", None, utcnow(); create_admin_log(actor, "report_released", "report", item.id, f"举报 #{item.id}", None, {"status": "pending"})
    error = _commit(); return error or success_response({"id": item.id, "status": item.status})


@admin_bp.post("/reports/<int:report_id>/reopen")
@require_system_admin()
def reopen(actor, report_id):
    item = _report_get(report_id)
    if not item: return _not_found()
    if item.status not in {"resolved", "rejected"}: return error_response("RESOURCE_CONFLICT", "只有已结束举报可重新打开。", 409)
    active_key = f"{item.reporter_id}:{item.target_type}:{item.target_id}"
    conflict = db.session.scalar(db.select(Report.id).where(Report.active_key == active_key, Report.id != item.id).with_for_update())
    if conflict: return error_response("RESOURCE_CONFLICT", "同一对象已有进行中的举报。", 409)
    item.status, item.active_key, item.assigned_to_id, item.handled_by_id, item.handled_at, item.updated_at = "in_progress", active_key, actor.id, None, None, utcnow()
    item.review_round += 1
    create_admin_log(actor, "report_reopened", "report", item.id, f"举报 #{item.id}", None, {"status": "in_progress", "review_round": item.review_round})
    try:
        db.session.commit()
    except Exception as error:
        db.session.rollback()
        from sqlalchemy.exc import IntegrityError
        if isinstance(error, IntegrityError): return error_response("RESOURCE_CONFLICT", "同一对象已有进行中的举报。", 409)
        current_app.logger.exception("举报重开失败。")
        return error_response("INTERNAL_ERROR", "举报重开失败。", 500)
    return success_response({"id": item.id, "status": item.status, "review_round": item.review_round})


def _apply_report_action(actor, report, action, message):
    target = resolve_admin_target(report.target_type, report.target_id, actor)
    if action not in REPORT_ACTIONS[report.target_type]: return None, _validation("举报处理动作不适用于该目标。")
    if action == "ban_user" and not is_system_admin(actor): return None, error_response("PERMISSION_DENIED", "内容管理员不能封禁用户。", 403)
    if action == "no_action" or not target: return [], None
    media = []
    target_user = db.session.get(User, target_author_id(report.target_type, target))
    if action == "hide_content":
        if target.status != "published": return None, error_response("RESOURCE_CONFLICT", "内容当前不能下架。", 409)
        before = _content_state(target); target.status, target.moderation_reason, target.hidden_at, target.hidden_by_id = "hidden", message, utcnow(), actor.id; _remove_feature(report.target_type, target.id)
        _notify(target.author_id, "content_hidden", {"target_type": report.target_type, "target_id": target.id, "reason": message}, actor, report.target_type, target.id); create_admin_log(actor, "content_hidden", report.target_type, target.id, target.title, before, _content_state(target))
    elif action == "delete_content": media = _delete_content(report.target_type, target, actor, "content_deleted", message)
    elif action == "hide_comment":
        if target.status != "active": return None, error_response("RESOURCE_CONFLICT", "评论当前不能隐藏。", 409)
        before = {"status": target.status}; target.status, target.updated_at = "hidden", utcnow(); create_admin_log(actor, "comment_hidden", "comment", target.id, f"评论 #{target.id}", before, {"status": "hidden"})
    elif action == "delete_comment":
        if target.status == "deleted": return None, error_response("RESOURCE_CONFLICT", "评论已删除。", 409)
        _soft_delete_comment(target); create_admin_log(actor, "comment_deleted", "comment", target.id, f"评论 #{target.id}", None, {"status": "deleted"})
    elif action == "restrict_publish": target_user.can_publish = False; _notify(target_user.id, "system", {"message": "你的发布权限已被限制。"}, actor); create_admin_log(actor, "user_publish_restricted", "user", target_user.id, target_user.username, {"can_publish": True}, {"can_publish": False})
    elif action == "restrict_comment": target_user.can_comment = False; _notify(target_user.id, "system", {"message": "你的评论权限已被限制。"}, actor); create_admin_log(actor, "user_comment_restricted", "user", target_user.id, target_user.username, {"can_comment": True}, {"can_comment": False})
    elif action == "ban_user":
        if target_user.id == actor.id: return None, error_response("PERMISSION_DENIED", "不能封禁自己。", 403)
        target_user.status = UserStatus.BANNED.value; db.session.execute(db.delete(RefreshSession).where(RefreshSession.user_id == target_user.id)); _notify(target_user.id, "system", {"message": "你的账号已被封禁。"}, actor); create_admin_log(actor, "user_banned", "user", target_user.id, target_user.username, {"status": "active"}, {"status": "banned"})
    elif action == "mark_guide_invalid":
        before = {"validity_status": target.validity_status}
        target.validity_status, target.last_confirmed_at = "invalid", utcnow()
        _notify(
            target.author_id,
            "guide_validity_changed",
            {"guide_title": target.title, "validity_status": "invalid", "reason": message},
            actor,
            "game_guide",
            target.id,
        )
        create_admin_log(
            actor,
            "guide_marked_invalid",
            "game_guide",
            target.id,
            target.title,
            before,
            {"validity_status": "invalid"},
            {"reason": message},
        )
    return media, None


def _finish_report(actor, report_id, rejected=False):
    payload = request.get_json(silent=True) or {}; item = _report_get(report_id)
    if not item: return _not_found()
    if payload.get("action") in {"delete_content", "ban_user"}:
        _, existing, key_error = _idempotency(actor)
        if key_error: return key_error
        if existing: return success_response({"id": item.id, "status": item.status, "already_processed": True})
    if item.status not in {"pending", "in_progress"}: return error_response("RESOURCE_CONFLICT", "举报已结束。", 409)
    if item.status == "pending":
        item.status, item.assigned_to_id = "in_progress", actor.id
    elif item.assigned_to_id != actor.id:
        if not is_system_admin(actor): return error_response("PERMISSION_DENIED", "只有领取该举报的管理员可以处理。", 403)
        previous = item.assigned_to_id
        item.assigned_to_id = actor.id
        create_admin_log(actor, "report_force_taken", "report", item.id, f"举报 #{item.id}", {"assigned_to_id": previous}, {"assigned_to_id": actor.id})
    message = payload.get("resolution_message")
    if not isinstance(message, str) or not 1 <= len(message.strip()) <= 1000: return _validation("处理说明为必填项，且最多 1000 字。")
    action = "no_action" if rejected else payload.get("action")
    if not isinstance(action, str): return _validation("请选择处理动作。")
    if action == "delete_content" and not _confirmed(payload, "DELETE"): return _validation("永久删除需要 confirmation=DELETE。")
    if action == "ban_user" and not _confirmed(payload, "BAN"): return _validation("封禁账号需要 confirmation=BAN。")
    note = payload.get("internal_note")
    if note is not None and (not isinstance(note, str) or len(note) > 5000): return _validation("内部备注不合法。")
    media, error = _apply_report_action(actor, item, action, message.strip())
    if error: return error
    all_open = db.session.scalars(db.select(Report).where(Report.target_type == item.target_type, Report.target_id == item.target_id, Report.status.in_(("pending", "in_progress")))).all()
    for report in all_open:
        report.status, report.active_key, report.handled_by_id, report.resolution_action, report.resolution_message, report.internal_note, report.handled_at, report.updated_at = ("rejected" if rejected and report.id == item.id else "resolved"), None, actor.id, action if report.id == item.id else ("target_removed" if action == "delete_content" else action), message.strip(), note if report.id == item.id else None, utcnow(), utcnow()
        report_result_notification(report, message.strip())
    create_admin_log(actor, "report_rejected" if rejected else "report_resolved", "report", item.id, f"举报 #{item.id}", {"status": "in_progress"}, {"status": "rejected" if rejected else "resolved", "action": action})
    failure = _commit("举报处理失败。")
    if failure: return failure
    for file in media or []:
        try: remove_media_files(file)
        except Exception: current_app.logger.exception("Unable to remove moderated media")
    return success_response({"id": item.id, "status": item.status, "resolution_action": item.resolution_action})


@admin_bp.post("/reports/<int:report_id>/resolve")
@require_content_admin()
def resolve(actor, report_id): return _finish_report(actor, report_id)
@admin_bp.post("/reports/<int:report_id>/reject")
@require_content_admin()
def reject(actor, report_id): return _finish_report(actor, report_id, True)


@admin_bp.get("/users")
@require_content_admin()
def users(actor):
    args = _page()
    if not args: return _validation("分页参数不合法。")
    page, size = args; stmt = db.select(User)
    query = request.args.get("query", "").strip()
    if query: stmt = stmt.where(or_(User.username.ilike(f"%{query}%"), User.nickname.ilike(f"%{query}%"), User.email.ilike(f"%{query}%")))
    for field, choices in (("role", {x.value for x in UserRole}), ("status", {x.value for x in UserStatus})):
        value = request.args.get(field)
        if value:
            if value not in choices: return _validation("筛选条件不合法。")
            stmt = stmt.where(getattr(User, field) == value)
    for field in ("can_publish", "can_comment"):
        if field in request.args:
            if request.args[field] not in {"true", "false"}: return _validation("筛选条件不合法。")
            stmt = stmt.where(getattr(User, field) == (request.args[field] == "true"))
    total = db.session.scalar(db.select(func.count()).select_from(stmt.subquery())); items = db.session.scalars(stmt.order_by(User.created_at.desc(), User.id.desc()).offset((page-1)*size).limit(size)).all()
    return success_response([admin_user_dict(item) for item in items], meta=_meta(page, size, total))


@admin_bp.get("/users/<int:user_id>")
@require_content_admin()
def user_detail(actor, user_id):
    target = db.session.get(User, user_id)
    if not target: return _not_found()
    data = admin_user_dict(target); data["stats"] = {"life_posts": db.session.scalar(db.select(func.count(LifePost.id)).where(LifePost.author_id == target.id)) or 0, "guides": db.session.scalar(db.select(func.count(GameGuide.id)).where(GameGuide.author_id == target.id)) or 0, "comments": db.session.scalar(db.select(func.count(Comment.id)).where(Comment.author_id == target.id)) or 0}; data["can_manage"] = can_manage_user(actor, target)
    return success_response(data)


def _user_mutation(actor, user_id, kind):
    target, payload = db.session.get(User, user_id), request.get_json(silent=True)
    if not target: return _not_found()
    if not isinstance(payload, dict) or not _reason(payload): return _validation("必须填写操作原因。")
    if not can_manage_user(actor, target): return error_response("PERMISSION_DENIED", "无权管理该用户。", 403)
    if kind == "status" and payload.get("status") == UserStatus.BANNED.value:
        _, existing, key_error = _idempotency(actor)
        if key_error: return key_error
        if existing: return success_response(admin_user_dict(target))
    if kind == "restrictions":
        if not any(key in payload for key in ("can_publish", "can_comment")) or any(key in payload and not isinstance(payload[key], bool) for key in ("can_publish", "can_comment")): return _validation("限制参数不合法。")
        before = {key: getattr(target, key) for key in ("can_publish", "can_comment")}
        for key in before:
            if key in payload: setattr(target, key, payload[key])
        _notify(target.id, "system", {"message": "你的账号权限已调整。", "reason": _reason(payload)}, actor)
    elif kind == "status":
        if not is_system_admin(actor) or payload.get("status") not in {UserStatus.ACTIVE.value, UserStatus.BANNED.value}: return error_response("PERMISSION_DENIED", "无权修改账号状态。", 403)
        if payload.get("status") == UserStatus.BANNED.value and not _confirmed(payload, "BAN"): return _validation("封禁账号需要 confirmation=BAN。")
        before = {"status": target.status}; target.status = payload["status"]; db.session.execute(db.delete(RefreshSession).where(RefreshSession.user_id == target.id)); _notify(target.id, "system", {"message": "你的账号状态已调整。", "reason": _reason(payload)}, actor)
    else:
        if not is_system_admin(actor) or payload.get("role") not in {x.value for x in UserRole}: return error_response("PERMISSION_DENIED", "无权修改角色。", 403)
        if target.id == actor.id: return error_response("PERMISSION_DENIED", "不能修改自己的角色。", 403)
        if target.role == UserRole.SYSTEM_ADMIN.value and payload["role"] != UserRole.SYSTEM_ADMIN.value and (db.session.scalar(db.select(func.count(User.id)).where(User.role == UserRole.SYSTEM_ADMIN.value, User.status == UserStatus.ACTIVE.value)) or 0) <= 1: return error_response("RESOURCE_CONFLICT", "不能移除最后一名系统管理员。", 409)
        before = {"role": target.role}; target.role = payload["role"]; db.session.execute(db.delete(RefreshSession).where(RefreshSession.user_id == target.id)); _notify(target.id, "system", {"message": "你的账号角色已调整。", "reason": _reason(payload)}, actor)
    create_admin_log(actor, f"user_{kind}_updated", "user", target.id, target.username, before, {key: getattr(target, key) for key in before}, {"reason": _reason(payload)})
    failure = _commit("用户设置保存失败。")
    return failure or success_response(admin_user_dict(target))


@admin_bp.patch("/users/<int:user_id>/restrictions")
@require_content_admin()
def user_restrictions(actor, user_id): return _user_mutation(actor, user_id, "restrictions")
@admin_bp.patch("/users/<int:user_id>/status")
@require_content_admin()
def user_status(actor, user_id): return _user_mutation(actor, user_id, "status")
@admin_bp.patch("/users/<int:user_id>/role")
@require_content_admin()
def user_role(actor, user_id): return _user_mutation(actor, user_id, "role")


def _admin_content_list(kind, actor):
    args = _page()
    if not args: return _validation("分页参数不合法。")
    page, size = args; model = _content_model(kind); stmt = db.select(model).options(*_content_options(kind))
    status = request.args.get("status")
    if status:
        if status not in {"published", "hidden"}: return _validation("内容状态不合法。")
        stmt = stmt.where(model.status == status)
    author_id = request.args.get("author_id")
    if author_id:
        try: stmt = stmt.where(model.author_id == int(author_id))
        except ValueError: return _validation("作者不合法。")
    if kind == "life_post":
        visibility = request.args.get("visibility")
        if visibility:
            if visibility not in {"public", "login_only", "private"}: return _validation("可见性不合法。")
            stmt = stmt.where(LifePost.visibility == visibility)
        chapter_id = request.args.get("chapter_id")
        if chapter_id:
            try: stmt = stmt.where(LifePost.chapter_id == int(chapter_id))
            except ValueError: return _validation("章节不合法。")
    else:
        for field in ("game_id", "hero_id", "map_id"):
            value = request.args.get(field)
            if value:
                try: stmt = stmt.where(getattr(GameGuide, field) == int(value))
                except ValueError: return _validation("教材筛选不合法。")
        validity = request.args.get("validity_status")
        if validity:
            if validity not in {"unverified", "valid", "possibly_invalid", "invalid"}: return _validation("教材有效状态不合法。")
            stmt = stmt.where(GameGuide.validity_status == validity)
    query = request.args.get("query", "").strip()
    if query: stmt = stmt.where(model.title.ilike(f"%{query}%"))
    total = db.session.scalar(db.select(func.count()).select_from(stmt.subquery())); items = db.session.scalars(stmt.order_by(model.updated_at.desc(), model.id.desc()).offset((page-1)*size).limit(size)).unique().all()
    return success_response([_content_data(kind, item, actor) for item in items], meta=_meta(page, size, total))


@admin_bp.get("/content/life-posts")
@require_content_admin()
def admin_life_posts(actor): return _admin_content_list("life_post", actor)
@admin_bp.get("/content/guides")
@require_content_admin()
def admin_guides(actor): return _admin_content_list("game_guide", actor)


@admin_bp.get("/content/comments")
@require_content_admin()
def admin_comments(actor):
    args = _page()
    if not args: return _validation("分页参数不合法。")
    page, size = args; stmt = db.select(Comment).options(joinedload(Comment.author))
    for field, choices in (("status", {"active", "hidden", "deleted"}), ("target_type", {"life_post", "game_guide"})):
        value = request.args.get(field)
        if value:
            if value not in choices: return _validation("筛选条件不合法。")
            stmt = stmt.where(getattr(Comment, field) == value)
    query = request.args.get("query", "").strip()
    if query: stmt = stmt.where(Comment.body.ilike(f"%{query}%"))
    total = db.session.scalar(db.select(func.count()).select_from(stmt.subquery())); items = db.session.scalars(stmt.order_by(Comment.updated_at.desc(), Comment.id.desc()).offset((page-1)*size).limit(size)).all()
    from app.comments.service import comment_dict
    return success_response([comment_dict(item, actor) for item in items], meta=_meta(page, size, total))


@admin_bp.post("/content/<target_type>/<int:target_id>/hide")
@require_content_admin()
def hide_content(actor, target_type, target_id):
    if target_type not in CONTENT_TARGET_TYPES: return _not_found()
    item, payload = resolve_admin_target(target_type, target_id, actor), request.get_json(silent=True)
    reason = _reason(payload)
    if not item: return _not_found()
    if not reason: return _validation("下架原因必填。")
    if item.status != "published": return error_response("RESOURCE_CONFLICT", "当前内容不能下架。", 409)
    before = _content_state(item); item.status, item.moderation_reason, item.hidden_at, item.hidden_by_id = "hidden", reason, utcnow(), actor.id; _remove_feature(target_type, item.id)
    _notify(item.author_id, "content_hidden", {"target_type": target_type, "target_id": item.id, "reason": reason}, actor, target_type, item.id)
    create_admin_log(actor, "content_hidden", target_type, item.id, item.title, before, _content_state(item)); failure = _commit("内容下架失败。")
    return failure or success_response(_content_data(target_type, item, actor))


@admin_bp.post("/content/<target_type>/<int:target_id>/restore")
@require_content_admin()
def restore_content(actor, target_type, target_id):
    if target_type not in CONTENT_TARGET_TYPES: return _not_found()
    item = resolve_admin_target(target_type, target_id, actor)
    if not item: return _not_found()
    if item.status != "hidden": return error_response("RESOURCE_CONFLICT", "当前内容不能恢复。", 409)
    before = _content_state(item); item.status, item.moderation_reason, item.hidden_at, item.hidden_by_id = "published", None, None, None; create_admin_log(actor, "content_restored", target_type, item.id, item.title, before, _content_state(item)); failure = _commit("内容恢复失败。")
    return failure or success_response(_content_data(target_type, item, actor))


@admin_bp.delete("/content/<target_type>/<int:target_id>")
@require_content_admin()
def delete_content(actor, target_type, target_id):
    if target_type not in CONTENT_TARGET_TYPES: return _not_found()
    payload = request.get_json(silent=True) or {}
    if not _reason(payload) or not _confirmed(payload, "DELETE"): return _validation("永久删除需要操作原因和 confirmation=DELETE。")
    _, existing, key_error = _idempotency(actor)
    if key_error: return key_error
    if existing: return "", 204
    item = db.session.scalar(db.select(_content_model(target_type)).where(_content_model(target_type).id == target_id).options(*_content_options(target_type)))
    if not item: return _not_found()
    media = _delete_content(target_type, item, actor, reason=_reason(payload)); failure = _commit("内容删除失败。")
    if failure: return failure
    for file in media:
        try: remove_media_files(file)
        except Exception: current_app.logger.exception("Unable to delete content media")
    return "", 204


@admin_bp.post("/content/<target_type>/<int:target_id>/feature")
@require_content_admin()
def feature(actor, target_type, target_id):
    if target_type not in CONTENT_TARGET_TYPES: return _not_found()
    item, payload = resolve_admin_target(target_type, target_id, actor), request.get_json(silent=True) or {}
    if not item: return _not_found()
    if item.status != "published" or (target_type == "life_post" and item.visibility != "public"): return error_response("RESOURCE_CONFLICT", "只有公开发布内容可以精选。", 409)
    note = payload.get("note")
    if note is not None and (not isinstance(note, str) or len(note) > 500): return _validation("精选说明不合法。")
    selected = db.session.scalar(db.select(FeaturedContent).where(FeaturedContent.target_type == target_type, FeaturedContent.target_id == target_id))
    if not selected: db.session.add(FeaturedContent(target_type=target_type, target_id=target_id, featured_by_id=actor.id, note=note)); create_admin_log(actor, "content_featured", target_type, target_id, item.title, None, {"featured": True})
    failure = _commit("设置精选失败。"); return failure or success_response({"target_type": target_type, "target_id": target_id, "featured": True})


@admin_bp.delete("/content/<target_type>/<int:target_id>/feature")
@require_content_admin()
def unfeature(actor, target_type, target_id):
    if target_type not in CONTENT_TARGET_TYPES: return _not_found()
    item = resolve_admin_target(target_type, target_id, actor)
    if not item: return _not_found()
    if db.session.execute(db.delete(FeaturedContent).where(FeaturedContent.target_type == target_type, FeaturedContent.target_id == target_id)).rowcount: create_admin_log(actor, "content_unfeatured", target_type, target_id, item.title, {"featured": True}, {"featured": False})
    failure = _commit("取消精选失败。"); return failure or "", 204


@admin_bp.get("/content/featured")
@require_content_admin()
def featured(actor):
    selected = db.session.scalars(db.select(FeaturedContent).order_by(FeaturedContent.created_at.desc()).options(joinedload(FeaturedContent.featured_by))).all()
    data = []
    for item in selected:
        target = resolve_admin_target(item.target_type, item.target_id, actor)
        if target: data.append({"id": item.id, "target_type": item.target_type, "target_id": item.target_id, "note": item.note, "created_at": serialize_datetime(item.created_at), "content": _content_data(item.target_type, target, actor)})
    return success_response(data)


@admin_bp.post("/guides/<int:guide_id>/mark-invalid")
@require_content_admin()
def mark_invalid(actor, guide_id):
    guide, data = db.session.get(GameGuide, guide_id), request.get_json(silent=True) or {}
    if not guide: return _not_found()
    reason = _reason(data)
    if not reason: return _validation("操作原因必填。")
    before = {"validity_status": guide.validity_status}; guide.validity_status, guide.last_confirmed_at = "invalid", utcnow(); _notify(guide.author_id, "guide_validity_changed", {"guide_title": guide.title, "validity_status": "invalid", "reason": reason}, actor, "game_guide", guide.id); create_admin_log(actor, "guide_marked_invalid", "game_guide", guide.id, guide.title, before, {"validity_status": "invalid"}, {"reason": reason}); failure = _commit("教材状态保存失败。")
    return failure or success_response(guide_dict(guide, actor, True))


@admin_bp.patch("/guides/<int:guide_id>/validity")
@require_content_admin()
def update_guide_validity(actor, guide_id):
    guide, data = db.session.get(GameGuide, guide_id), request.get_json(silent=True) or {}
    if not guide: return _not_found()
    status, reason = data.get("validity_status"), _reason(data)
    if status not in {"unverified", "valid", "possibly_invalid", "invalid"} or not reason:
        return _validation("有效状态和操作原因必填。")
    before = {"validity_status": guide.validity_status}
    guide.validity_status, guide.last_confirmed_at = status, utcnow()
    _notify(guide.author_id, "guide_validity_changed", {"guide_title": guide.title, "validity_status": status, "reason": reason}, actor, "game_guide", guide.id)
    create_admin_log(actor, "guide_validity_updated", "game_guide", guide.id, guide.title, before, {"validity_status": status}, {"reason": reason})
    failure = _commit("教材状态保存失败。")
    return failure or success_response(guide_dict(guide, actor, True))


@admin_bp.patch("/guides/<int:guide_id>/metadata")
@require_content_admin()
def update_guide_metadata(actor, guide_id):
    guide, data = db.session.get(GameGuide, guide_id), request.get_json(silent=True) or {}
    if not guide: return _not_found()
    allowed_categories = {"deployment_position", "skill_throw", "timed_throw", "hold_position", "movement_route", "map_interaction", "other"}
    updates = {field: data[field] for field in ("game_id", "map_id", "hero_id", "category") if field in data}
    if not updates: return _validation("至少提交一项地图、英雄、游戏或分类修正。")
    if "category" in updates and updates["category"] not in allowed_categories: return _validation("点位分类不合法。")
    game_id = updates.get("game_id", guide.game_id); map_id = updates.get("map_id", guide.map_id); hero_id = updates.get("hero_id", guide.hero_id)
    if not all(isinstance(value, int) and not isinstance(value, bool) and value > 0 for value in (game_id, map_id, hero_id)):
        return _validation("游戏、地图和英雄必须是有效 ID。")
    game, game_map, hero = db.session.get(Game, game_id), db.session.get(GameMap, map_id), db.session.get(GameHero, hero_id)
    if not game or not game_map or not hero or game_map.game_id != game_id or hero.game_id != game_id: return _validation("地图和英雄必须属于同一游戏。")
    if updates.get("category") == "timed_throw" and not guide.timing: return _validation("开局定时投掷必须已有投掷时间或时机。")
    reason = _reason(data)
    if not reason: return _validation("操作原因必填。")
    before = {field: getattr(guide, field) for field in updates}
    for field, value in updates.items(): setattr(guide, field, value)
    guide.guide_scope, guide.updated_at = "hero_map", utcnow()
    _notify(guide.author_id, "system", {"message": "管理员修正了你的点位目录关联。", "guide_title": guide.title, "reason": reason}, actor, "game_guide", guide.id)
    create_admin_log(actor, "guide_metadata_updated", "game_guide", guide.id, guide.title, before, {field: getattr(guide, field) for field in updates}, {"reason": reason})
    failure = _commit("点位关联保存失败。")
    return failure or success_response(guide_dict(db.session.scalar(db.select(GameGuide).where(GameGuide.id == guide.id).options(*GUIDE_OPTIONS)), actor, True))


@admin_bp.post("/guides/bulk-possibly-invalid")
@require_content_admin()
def bulk_mark_guides_possibly_invalid(actor):
    data = request.get_json(silent=True) or {}; reason = _reason(data)
    if not reason or not _confirmed(data, "BULK_POSSIBLY_INVALID"): return _validation("批量标记需要原因和 confirmation=BULK_POSSIBLY_INVALID。")
    _, existing, key_error = _idempotency(actor)
    if key_error: return key_error
    if existing: return success_response({"updated": 0, "already_processed": True})
    game_id, map_id, hero_id = data.get("game_id"), data.get("map_id"), data.get("hero_id")
    valid_id = lambda value: isinstance(value, int) and not isinstance(value, bool) and value > 0
    if not valid_id(game_id) or not (valid_id(map_id) or valid_id(hero_id)) or (map_id is not None and not valid_id(map_id)) or (hero_id is not None and not valid_id(hero_id)): return _validation("需指定有效游戏及地图或英雄。")
    game, game_map, hero = db.session.get(Game, game_id), db.session.get(GameMap, map_id) if map_id is not None else None, db.session.get(GameHero, hero_id) if hero_id is not None else None
    if not game or (game_map and game_map.game_id != game.id) or (hero and hero.game_id != game.id): return _validation("地图和英雄必须属于指定游戏。")
    stmt = db.select(GameGuide).where(GameGuide.game_id == game_id, GameGuide.status == "published")
    if isinstance(map_id, int): stmt = stmt.where(GameGuide.map_id == map_id)
    if isinstance(hero_id, int): stmt = stmt.where(GameGuide.hero_id == hero_id)
    items = db.session.scalars(stmt).all()
    for guide in items:
        before = {"validity_status": guide.validity_status}; guide.validity_status, guide.last_confirmed_at = "possibly_invalid", utcnow()
        _notify(guide.author_id, "guide_validity_changed", {"guide_title": guide.title, "validity_status": "possibly_invalid", "reason": reason}, actor, "game_guide", guide.id)
        create_admin_log(actor, "guide_bulk_possibly_invalid", "game_guide", guide.id, guide.title, before, {"validity_status": "possibly_invalid"}, {"reason": reason})
    if not items:
        create_admin_log(actor, "guide_bulk_possibly_invalid_empty", "game", game.id, game.name_zh, None, {"updated": 0}, {"reason": reason, "map_id": map_id, "hero_id": hero_id})
    failure = _commit("批量点位状态保存失败。")
    return failure or success_response({"updated": len(items)})


@admin_bp.post("/comments/<int:comment_id>/hide")
@require_content_admin()
def hide_comment(actor, comment_id):
    item = db.session.get(Comment, comment_id)
    if not item: return _not_found()
    if item.status != "active": return error_response("RESOURCE_CONFLICT", "当前评论不能隐藏。", 409)
    item.status, item.updated_at = "hidden", utcnow(); create_admin_log(actor, "comment_hidden", "comment", item.id, f"评论 #{item.id}", {"status": "active"}, {"status": "hidden"}); failure = _commit("评论隐藏失败。")
    return failure or success_response({"id": item.id, "status": item.status})


@admin_bp.post("/comments/<int:comment_id>/restore")
@require_content_admin()
def restore_comment(actor, comment_id):
    item = db.session.get(Comment, comment_id)
    if not item: return _not_found()
    if item.status != "hidden": return error_response("RESOURCE_CONFLICT", "当前评论不能恢复。", 409)
    item.status, item.updated_at = "active", utcnow(); create_admin_log(actor, "comment_restored", "comment", item.id, f"评论 #{item.id}", {"status": "hidden"}, {"status": "active"}); failure = _commit("评论恢复失败。")
    return failure or success_response({"id": item.id, "status": item.status})


@admin_bp.delete("/comments/<int:comment_id>")
@require_content_admin()
def delete_comment(actor, comment_id):
    payload = request.get_json(silent=True) or {}
    if not _reason(payload) or not _confirmed(payload, "DELETE"): return _validation("永久删除需要操作原因和 confirmation=DELETE。")
    _, existing, key_error = _idempotency(actor)
    if key_error: return key_error
    if existing: return "", 204
    item = db.session.get(Comment, comment_id)
    if not item: return _not_found()
    if item.status == "deleted": return error_response("RESOURCE_CONFLICT", "评论已删除。", 409)
    _soft_delete_comment(item); create_admin_log(actor, "comment_deleted", "comment", item.id, f"评论 #{item.id}", None, {"status": "deleted"}, {"reason": _reason(payload)}); failure = _commit("评论删除失败。")
    return failure or ("", 204)


def _validate_chapter_parent(chapter, parent_id):
    parent = db.session.get(LifeChapter, parent_id) if parent_id else None
    if parent_id and (not parent or parent.id == chapter.id or parent.status != "active" or parent.review_status != "approved" or parent.parent_id is not None): return None
    if parent and chapter.children: return None
    if parent and chapter.parent_id == parent.id: return parent
    current = parent
    while current:
        if current.id == chapter.id: return None
        current = current.parent
    return parent


@admin_bp.get("/chapters")
@require_content_admin()
def chapters(actor):
    args = _page()
    if not args: return _validation("分页参数不合法。")
    page, size = args; stmt = db.select(LifeChapter).options(*CHAPTER_OPTIONS, selectinload(LifeChapter.children))
    for field, choices in (("review_status", {"pending","approved","rejected"}), ("status", {"active","disabled","merged"}), ("chapter_type", {"city", "scenic", "travel", "campus", "event", "custom"})):
        value = request.args.get(field)
        if value:
            if value not in choices: return _validation("筛选条件不合法。")
            stmt = stmt.where(getattr(LifeChapter, field) == value)
    if request.args.get("parent_id"):
        try: stmt = stmt.where(LifeChapter.parent_id == int(request.args["parent_id"]))
        except ValueError: return _validation("父章节不合法。")
    query = request.args.get("query", "").strip()
    if query: stmt = stmt.where(or_(LifeChapter.name.ilike(f"%{query}%"), LifeChapter.normalized_name.ilike(f"%{normalize_name(query)}%")))
    total = db.session.scalar(db.select(func.count()).select_from(stmt.subquery())); items = db.session.scalars(stmt.order_by(LifeChapter.updated_at.desc(), LifeChapter.id.desc()).offset((page-1)*size).limit(size)).unique().all()
    stats = chapter_stats([item.id for item in items], actor, include_all=True)
    return success_response([
        managed_chapter_dict(
            item,
            actor,
            stats=stats,
            child_count=sum(child.status != "merged" for child in item.children),
        )
        for item in items
    ], meta=_meta(page,size,total))


@admin_bp.get("/chapters/<int:chapter_id>")
@require_content_admin()
def chapter_detail(actor, chapter_id):
    chapter = db.session.scalar(db.select(LifeChapter).where(LifeChapter.id == chapter_id).options(*CHAPTER_OPTIONS, selectinload(LifeChapter.children)))
    if not chapter: return _not_found()
    stats = chapter_stats([chapter.id], actor, include_all=True)
    return success_response(managed_chapter_dict(
        chapter,
        actor,
        stats=stats,
        child_count=sum(child.status != "merged" for child in chapter.children),
    ))


@admin_bp.post("/chapters/<int:chapter_id>/approve")
@require_content_admin()
def approve_chapter(actor, chapter_id):
    chapter, data = db.session.get(LifeChapter, chapter_id), request.get_json(silent=True) or {}
    if not chapter: return _not_found()
    if chapter.review_status not in {"pending", "rejected"}: return error_response("RESOURCE_CONFLICT", "章节当前无需审核。", 409)
    note = data.get("review_note")
    if note is not None and (not isinstance(note, str) or len(note) > 1000): return _validation("审核意见不合法。")
    before = {"review_status": chapter.review_status}; chapter.review_status, chapter.review_note, chapter.reviewed_by_id, chapter.reviewed_at = "approved", note.strip() if isinstance(note,str) else None, actor.id, utcnow(); _notify(chapter.creator_id, "chapter_review", {"chapter_id": chapter.id, "status": "approved", "message": chapter.review_note or "你的章节申请已通过。"}, actor); create_admin_log(actor, "chapter_approved", "life_chapter", chapter.id, chapter.name, before, {"review_status": "approved"}); failure = _commit("章节审核失败。")
    return failure or success_response({"id": chapter.id, "review_status": chapter.review_status})


@admin_bp.post("/chapters/<int:chapter_id>/reject")
@require_content_admin()
def reject_chapter(actor, chapter_id):
    chapter, data = db.session.get(LifeChapter, chapter_id), request.get_json(silent=True) or {}; note = data.get("review_note")
    if not chapter: return _not_found()
    if chapter.review_status != "pending" or not isinstance(note, str) or not note.strip() or len(note.strip()) > 1000: return _validation("待审核章节需要有效的驳回意见。")
    chapter.review_status, chapter.review_note, chapter.reviewed_by_id, chapter.reviewed_at = "rejected", note.strip(), actor.id, utcnow(); _notify(chapter.creator_id, "chapter_review", {"chapter_id": chapter.id, "status": "rejected", "message": note.strip()}, actor); create_admin_log(actor, "chapter_rejected", "life_chapter", chapter.id, chapter.name, {"review_status":"pending"}, {"review_status":"rejected"}); failure = _commit("章节驳回失败。")
    return failure or success_response({"id": chapter.id, "review_status": chapter.review_status})


@admin_bp.patch("/chapters/<int:chapter_id>")
@require_content_admin()
def update_chapter(actor, chapter_id):
    payload = request.get_json(silent=True)
    try:
        chapter = update_chapter_service(chapter_id, actor, payload, normalize_name)
    except ChapterOperationError as error:
        return _chapter_error(error)
    except Exception:
        current_app.logger.exception("Unable to update life chapter")
        return error_response("INTERNAL_ERROR", "章节保存失败，请稍后重试。", 500)
    stats = chapter_stats([chapter.id], actor, include_all=True)
    return success_response(managed_chapter_dict(chapter, actor, stats=stats))


@admin_bp.get("/chapters/<int:chapter_id>/deletion-preview")
@require_content_admin()
def admin_chapter_deletion_preview(actor, chapter_id):
    try:
        return success_response(preview_chapter_deletion(chapter_id, actor))
    except ChapterOperationError as error:
        return _chapter_error(error)


@admin_bp.post("/chapters/<int:chapter_id>/delete")
@require_content_admin()
def admin_delete_chapter(actor, chapter_id):
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict): return _validation("请求体必须是 JSON 对象。")
    try:
        result = delete_or_merge_chapter(
            chapter_id,
            actor,
            confirmation_name=payload.get("confirmation_name"),
            target_chapter_id=payload.get("target_chapter_id"),
            reason=payload.get("reason"),
        )
    except ChapterOperationError as error:
        return _chapter_error(error)
    except Exception:
        current_app.logger.exception("Unable to delete or merge life chapter")
        return error_response("INTERNAL_ERROR", "章节删除失败，请稍后重试。", 500)
    return success_response(result)


@admin_bp.post("/chapters/<int:chapter_id>/force-delete")
@require_system_admin()
def force_delete_chapter(actor, chapter_id):
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict): return _validation("请求体必须是 JSON 对象。")
    _, existing, key_error = _idempotency(actor)
    if key_error: return key_error
    if existing:
        if existing.action != "chapter_force_deleted" or existing.target_type != "life_chapter" or existing.target_id != chapter_id:
            return error_response("RESOURCE_CONFLICT", "该 Idempotency-Key 已用于其他管理员操作。", 409)
        metadata = existing.metadata_json if isinstance(existing.metadata_json, dict) else {}
        return success_response({
            "chapter_id": chapter_id,
            "deleted_post_count": metadata.get("post_count", 0),
            "deleted_child_count": metadata.get("child_count", 0),
            "deleted_image_count": metadata.get("image_count", 0),
            "already_processed": True,
        })
    try:
        result = force_delete_chapter_service(
            chapter_id,
            actor,
            reason=payload.get("reason"),
            confirmation=payload.get("confirmation"),
            cascade_posts=payload.get("cascade_posts"),
            cascade_children=payload.get("cascade_children"),
        )
    except ChapterOperationError as error:
        return _chapter_error(error)
    except IntegrityError:
        db.session.rollback()
        _, existing, _ = _idempotency(actor)
        if (
            existing
            and existing.action == "chapter_force_deleted"
            and existing.target_type == "life_chapter"
            and existing.target_id == chapter_id
        ):
            metadata = (
                existing.metadata_json
                if isinstance(existing.metadata_json, dict)
                else {}
            )
            return success_response({
                "chapter_id": chapter_id,
                "deleted_post_count": metadata.get("post_count", 0),
                "deleted_child_count": metadata.get("child_count", 0),
                "deleted_image_count": metadata.get("image_count", 0),
                "already_processed": True,
            })
        return error_response(
            "RESOURCE_CONFLICT",
            "该 Idempotency-Key 已用于其他管理员操作。",
            409,
        )
    except Exception:
        current_app.logger.exception("Unable to force delete life chapter")
        return error_response("INTERNAL_ERROR", "章节强制删除失败，请稍后重试。", 500)
    return success_response(result)


@admin_bp.post("/chapters/<int:chapter_id>/disable")
@require_content_admin()
def disable_chapter(actor, chapter_id):
    chapter = db.session.get(LifeChapter, chapter_id)
    if not chapter: return _not_found()
    if chapter.status != "active": return error_response("RESOURCE_CONFLICT", "章节当前不能禁用。", 409)
    chapter.status = "disabled"; create_admin_log(actor, "chapter_disabled", "life_chapter", chapter.id, chapter.name, {"status":"active"}, {"status":"disabled"}); failure = _commit("章节禁用失败。")
    return failure or success_response({"id":chapter.id,"status":chapter.status})


@admin_bp.post("/chapters/<int:chapter_id>/enable")
@require_content_admin()
def enable_chapter(actor, chapter_id):
    chapter = db.session.get(LifeChapter, chapter_id)
    if not chapter: return _not_found()
    if chapter.status != "disabled" or chapter.review_status != "approved": return error_response("RESOURCE_CONFLICT", "章节当前不能启用。", 409)
    if chapter.parent_id and not _validate_chapter_parent(chapter, chapter.parent_id): return error_response("RESOURCE_CONFLICT", "章节层级无效，不能启用。", 409)
    if chapter.parent_id is None and any(child.parent_id != chapter.id for child in chapter.children): return error_response("RESOURCE_CONFLICT", "章节层级无效，不能启用。", 409)
    chapter.status="active"; create_admin_log(actor,"chapter_enabled","life_chapter",chapter.id,chapter.name,{"status":"disabled"},{"status":"active"}); failure=_commit("章节启用失败。")
    return failure or success_response({"id":chapter.id,"status":chapter.status})


@admin_bp.put("/chapters/<int:chapter_id>/cover")
@require_content_admin()
def chapter_cover(actor, chapter_id):
    data = request.get_json(silent=True) or {}
    media_id = data.get("media_id")
    if not isinstance(media_id, int) or media_id <= 0: return _validation("封面图片不合法。")
    try:
        chapter = update_chapter_service(
            chapter_id,
            actor,
            {"cover_media_id": media_id},
            normalize_name,
        )
    except ChapterOperationError as error:
        return _chapter_error(error)
    except Exception:
        current_app.logger.exception("Unable to set chapter cover")
        return error_response("INTERNAL_ERROR", "章节封面保存失败。", 500)
    return success_response({"id":chapter.id,"cover_media_id":chapter.cover_media_id})


@admin_bp.delete("/chapters/<int:chapter_id>/cover")
@require_content_admin()
def remove_chapter_cover(actor, chapter_id):
    chapter=db.session.get(LifeChapter,chapter_id)
    if not chapter:return _not_found()
    if not chapter.cover_media_id:return "",204
    try:
        update_chapter_service(
            chapter_id,
            actor,
            {"cover_media_id": None},
            normalize_name,
        )
    except ChapterOperationError as error:
        return _chapter_error(error)
    except Exception:
        current_app.logger.exception("Unable to remove chapter cover")
        return error_response("INTERNAL_ERROR", "章节封面移除失败。", 500)
    return "",204


@admin_bp.post("/chapters/<int:source_id>/merge")
@require_content_admin()
def merge_chapter(actor, source_id):
    data=request.get_json(silent=True) or {}; target_id=data.get("target_chapter_id"); reason=_reason(data)
    if not isinstance(target_id,int) or target_id<=0 or not reason:return _validation("目标章节和合并原因必填。")
    try:
        result = delete_or_merge_chapter(
            source_id,
            actor,
            confirmation_name=None,
            target_chapter_id=target_id,
            reason=reason,
            merge_even_if_empty=True,
            require_confirmation=False,
            audit_action="chapter_merged",
        )
    except ChapterOperationError as error:
        return _chapter_error(error)
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Unable to merge life chapter")
        return error_response("INTERNAL_ERROR", "章节合并失败。", 500)
    return success_response({
        "source_id": result["source_id"],
        "target_id": result["target_chapter_id"],
        "target_chapter_id": result["target_chapter_id"],
        "canonical_slug": result["canonical_slug"],
    })


def _catalog_list(model, actor):
    args=_page()
    if not args:return _validation("分页参数不合法。")
    page,size=args; stmt=db.select(model)
    status=request.args.get("status")
    if model is Game and status:
        if status not in {"active","inactive"}:return _validation("游戏状态筛选值不合法。")
        stmt=stmt.where(Game.status==status)
    raw_game_id=request.args.get("game_id")
    if raw_game_id:
        try: game_id=int(raw_game_id)
        except ValueError: return _validation("游戏 ID 不合法。")
        if game_id<=0:return _validation("游戏 ID 不合法。")
        stmt=stmt.where(Game.id==game_id) if model is Game else stmt.where(model.game_id==game_id)
    query=request.args.get("query","").strip()
    if query:stmt=stmt.where(model.search_text.ilike(f"%{query}%"))
    total=db.session.scalar(db.select(func.count()).select_from(stmt.subquery())); items=db.session.scalars(stmt.order_by(model.updated_at.desc(),model.id.desc()).offset((page-1)*size).limit(size)).all()
    from app.games.routes import game_dict, hero_dict, map_dict, game_counts
    if model is Game:
        counts=game_counts([item.id for item in items])
        return success_response([game_dict(item,counts) for item in items],meta=_meta(page,size,total))
    ids=[item.id for item in items]; relation=GameGuide.hero_id if model is GameHero else GameGuide.map_id
    guide_counts=dict(db.session.execute(db.select(relation,func.count(GameGuide.id)).where(relation.in_(ids)).group_by(relation)).all()) if ids else {}
    data=[]
    for item in items:
        serialized=hero_dict(item) if model is GameHero else map_dict(item)
        serialized["guide_count"]=guide_counts.get(item.id,0)
        data.append(serialized)
    return success_response(data,meta=_meta(page,size,total))

@admin_bp.get("/catalog/games")
@require_content_admin()
def catalog_games(actor):return _catalog_list(Game,actor)
@admin_bp.get("/catalog/heroes")
@require_content_admin()
def catalog_heroes(actor):return _catalog_list(GameHero,actor)
@admin_bp.get("/catalog/maps")
@require_content_admin()
def catalog_maps(actor):return _catalog_list(GameMap,actor)


@admin_bp.delete("/catalog/maps/<int:map_id>")
@require_system_admin()
def delete_catalog_map(actor, map_id):
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict): return _validation("请求体必须是 JSON 对象。")
    reason = _reason(payload)
    expected_confirmation = f"DELETE MAP {map_id}"
    cascade_guides = payload.get("cascade_guides")
    if not reason: return _validation("删除原因必填。")
    if not _confirmed(payload, expected_confirmation): return _validation(f"确认词必须严格等于 {expected_confirmation}。")
    if not isinstance(cascade_guides, bool): return _validation("cascade_guides 必须是布尔值。")

    _, existing, key_error = _idempotency(actor)
    if key_error: return key_error
    if existing:
        if existing.action != "catalog_map_deleted" or existing.target_type != "game_map" or existing.target_id != map_id:
            return error_response("RESOURCE_CONFLICT", "该 Idempotency-Key 已用于其他管理员操作。", 409)
        metadata = existing.metadata_json if isinstance(existing.metadata_json, dict) else {}
        return success_response({"map_id": map_id, "deleted_guide_count": metadata.get("deleted_guide_count", 0)})

    try:
        game_map = db.session.scalar(
            db.select(GameMap)
            .where(GameMap.id == map_id)
            .options(joinedload(GameMap.cover_media))
        )
        if not game_map: return _not_found()

        guides = db.session.scalars(
            db.select(GameGuide)
            .where(GameGuide.map_id == map_id)
            .options(*GUIDE_OPTIONS)
            .order_by(GameGuide.id.asc())
        ).unique().all()
        guide_count = len(guides)
        if guide_count and not cascade_guides:
            return error_response(
                "RESOURCE_CONFLICT",
                "该地图仍有关联点位，确认级联删除后才能永久删除。",
                409,
                [{"field": "cascade_guides", "code": "guides_exist", "message": "地图存在关联点位。", "guide_count": guide_count}],
            )

        before = {
            "id": game_map.id,
            "game_id": game_map.game_id,
            "name_zh": game_map.name_zh,
            "name_en": game_map.name_en,
            "slug": game_map.slug,
            "current_status": game_map.current_status,
            "review_status": game_map.review_status,
            "guide_count": guide_count,
        }
        create_admin_log(
            actor,
            "catalog_map_deleted",
            "game_map",
            game_map.id,
            game_map.name_zh,
            before,
            {"status": "deleted"},
            {
                "reason": reason,
                "cascade_guides": cascade_guides,
                "deleted_guide_count": guide_count,
            },
        )

        guide_media = []
        for guide in guides:
            guide_media.extend(
                _delete_content(
                    "game_guide",
                    guide,
                    actor,
                    action="guide_deleted_with_map",
                    reason=reason,
                )
            )

        cover_media = game_map.cover_media
        db.session.delete(game_map)
        db.session.flush()
        if cover_media: db.session.delete(cover_media)
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Unable to permanently delete game map")
        return error_response("INTERNAL_ERROR", "地图删除失败，请稍后重试。", 500)

    for media in [*guide_media, *([cover_media] if cover_media else [])]:
        try: remove_media_files(media)
        except Exception: current_app.logger.exception("Unable to delete map cascade media")
    return success_response({"map_id": map_id, "deleted_guide_count": guide_count})


@admin_bp.get("/logs")
@require_system_admin()
def logs(actor):
    args=_page()
    if not args:return _validation("分页参数不合法。")
    page,size=args; stmt=db.select(AdminLog).options(joinedload(AdminLog.admin))
    for field in ("admin_id","target_id"):
        if request.args.get(field):
            try:stmt=stmt.where(getattr(AdminLog,field)==int(request.args[field]))
            except ValueError:return _validation("筛选条件不合法。")
    for field in ("action","target_type"):
        if request.args.get(field):stmt=stmt.where(getattr(AdminLog,field)==request.args[field])
    for field, operator in (("date_from", ">="), ("date_to", "<=")):
        value = request.args.get(field)
        if value:
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError: return _validation("日期范围不合法。")
            stmt = stmt.where(AdminLog.created_at >= parsed if operator == ">=" else AdminLog.created_at <= parsed)
    total=db.session.scalar(db.select(func.count()).select_from(stmt.subquery()));items=db.session.scalars(stmt.order_by(AdminLog.created_at.desc(),AdminLog.id.desc()).offset((page-1)*size).limit(size)).all()
    return success_response([admin_log_dict(item) for item in items],meta=_meta(page,size,total))

@admin_bp.get("/logs/<int:log_id>")
@require_system_admin()
def log_detail(actor,log_id):
    item=db.session.scalar(db.select(AdminLog).where(AdminLog.id==log_id).options(joinedload(AdminLog.admin)))
    return success_response(admin_log_dict(item)) if item else _not_found()
