from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import or_

from app.common.responses import error_response, success_response
from app.extensions import db
from app.interactions.targets import TARGET_TYPES, resolve_target, target_summary
from app.models import Comment, GameGuide, LifePost, Notification, User, UserStatus
from app.life.routes import can_view_post
from app.models.content_like import utcnow
from app.notifications.service import create_comment_notification
from . import comments_bp
from .service import can_delete, comment_dict, validate_body


def user():
    identity = get_jwt_identity(); return db.session.get(User, int(identity)) if identity else None
def page_args():
    try: page, size = int(request.args.get("page", 1)), int(request.args.get("page_size", 20))
    except ValueError: return None
    return (page, size) if page >= 1 and 1 <= size <= 100 else None
def meta(page, size, total): return {"pagination": {"page": page, "page_size": size, "total": total, "total_pages": (total + size - 1) // size, "has_next": page * size < total, "has_previous": page > 1}}


@comments_bp.get("")
@jwt_required(optional=True, locations=["headers"])
def list_comments():
    actor = user(); kind = request.args.get("target_type"); args = page_args()
    try: target_id = int(request.args.get("target_id", ""))
    except ValueError: target_id = 0
    info = resolve_target(kind, target_id, actor)
    if not info: return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    if not args or request.args.get("sort", "oldest") not in {"oldest", "latest"}: return error_response("VALIDATION_ERROR", "分页参数不合法。", 400)
    page, size = args
    reply_counts = db.select(Comment.parent_id, db.func.count(Comment.id).label("count")).where(Comment.target_type == kind, Comment.target_id == target_id, Comment.parent_id.is_not(None), Comment.status.in_(("active", "deleted"))).group_by(Comment.parent_id).subquery()
    visible = or_(Comment.status == "active", db.and_(Comment.status == "deleted", db.func.coalesce(reply_counts.c.count, 0) > 0))
    stmt = db.select(Comment, db.func.coalesce(reply_counts.c.count, 0)).outerjoin(reply_counts, reply_counts.c.parent_id == Comment.id).where(Comment.target_type == kind, Comment.target_id == target_id, Comment.parent_id.is_(None), visible)
    total = db.session.scalar(db.select(db.func.count()).select_from(stmt.subquery())); order = Comment.created_at.asc() if request.args.get("sort", "oldest") == "oldest" else Comment.created_at.desc()
    rows = db.session.execute(stmt.order_by(order, Comment.id.asc()).offset((page - 1) * size).limit(size)).all()
    parent_ids = [x.id for x, _ in rows]; previews = {}
    if parent_ids:
        replies = db.session.scalars(db.select(Comment).where(Comment.parent_id.in_(parent_ids), Comment.status.in_(("active", "deleted"))).order_by(Comment.created_at.asc(), Comment.id.asc())).all()
        for item in replies:
            previews.setdefault(item.parent_id, [])
            if len(previews[item.parent_id]) < 3: previews[item.parent_id].append(comment_dict(item, actor))
    return success_response([comment_dict(item, actor, count, previews.get(item.id)) for item, count in rows], meta=meta(page, size, total))


@comments_bp.get("/<int:comment_id>/replies")
@jwt_required(optional=True, locations=["headers"])
def replies(comment_id):
    actor = user(); item = db.session.get(Comment, comment_id)
    if not item: return error_response("RESOURCE_NOT_FOUND", "评论不存在。", 404)
    parent_id = item.parent_id or item.id; parent = db.session.get(Comment, parent_id)
    if not resolve_target(parent.target_type, parent.target_id, actor): return error_response("RESOURCE_NOT_FOUND", "评论不存在。", 404)
    args = page_args()
    if not args: return error_response("VALIDATION_ERROR", "分页参数不合法。", 400)
    page, size = args; stmt = db.select(Comment).where(Comment.parent_id == parent_id, Comment.status.in_(("active", "deleted")))
    total = db.session.scalar(db.select(db.func.count()).select_from(stmt.subquery())); items = db.session.scalars(stmt.order_by(Comment.created_at.asc(), Comment.id.asc()).offset((page - 1) * size).limit(size)).all()
    return success_response([comment_dict(x, actor) for x in items], meta=meta(page, size, total))


@comments_bp.post("")
@jwt_required(locations=["headers"])
def create():
    actor = user()
    if not actor or actor.status != UserStatus.ACTIVE.value or not actor.can_comment: return error_response("PERMISSION_DENIED", "当前账号没有评论权限。", 403)
    data = request.get_json(silent=True) or {}; kind = data.get("target_type"); target_id = data.get("target_id")
    info = resolve_target(kind, target_id, actor)
    if not info: return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    try: body = validate_body(data.get("body"))
    except ValueError: return error_response("VALIDATION_ERROR", "评论内容须为 1 至 500 个字符。", 400)
    reply_id = data.get("reply_to_comment_id"); replied = None
    if reply_id is not None:
        if not isinstance(reply_id, int) or reply_id <= 0: return error_response("VALIDATION_ERROR", "回复目标不合法。", 400)
        replied = db.session.get(Comment, reply_id)
        if not replied or replied.status != "active" or replied.target_type != kind or replied.target_id != target_id: return error_response("VALIDATION_ERROR", "回复目标不存在或不可回复。", 400)
    item = Comment(target_type=kind, target_id=target_id, author_id=actor.id, body=body, parent_id=(replied.parent_id or replied.id) if replied else None, reply_to_comment_id=replied.id if replied else None, reply_to_user_id=replied.author_id if replied else None)
    db.session.add(item); db.session.flush(); create_comment_notification(info, item, actor, bool(replied)); db.session.commit()
    return success_response(comment_dict(item, actor), 201)


@comments_bp.delete("/<int:comment_id>")
@jwt_required(locations=["headers"])
def delete(comment_id):
    actor = user(); item = db.session.get(Comment, comment_id)
    if not item: return error_response("RESOURCE_NOT_FOUND", "评论不存在。", 404)
    if not can_delete(item, actor): return error_response("PERMISSION_DENIED", "无权删除此评论。", 403)
    if item.status != "deleted":
        item.body = None; item.status = "deleted"; item.deleted_at = utcnow(); item.updated_at = utcnow(); db.session.execute(db.delete(Notification).where(Notification.comment_id == item.id))
        from app.moderation.service import close_open_reports_for_target
        close_open_reports_for_target("comment", item.id)
        db.session.commit()
    return "", 204


@comments_bp.get("/me")
@jwt_required(locations=["headers"])
def mine():
    actor = user(); kind = request.args.get("target_type", "all"); args = page_args()
    if (kind != "all" and kind not in TARGET_TYPES) or not args: return error_response("VALIDATION_ERROR", "查询参数不合法。", 400)
    stmt = db.select(Comment).where(Comment.author_id == actor.id, Comment.status == "active")
    if kind != "all": stmt = stmt.where(Comment.target_type == kind)
    rows = db.session.scalars(stmt.order_by(Comment.created_at.desc(), Comment.id.desc())).all()
    life_ids = {row.target_id for row in rows if row.target_type == "life_post"}
    guide_ids = {row.target_id for row in rows if row.target_type == "game_guide"}
    posts = {item.id: item for item in db.session.scalars(db.select(LifePost).where(LifePost.id.in_(life_ids))).all()} if life_ids else {}
    guides = {item.id: item for item in db.session.scalars(db.select(GameGuide).where(GameGuide.id.in_(guide_ids))).all()} if guide_ids else {}
    items = []
    for row in rows:
        if row.target_type == "life_post":
            target = posts.get(row.target_id)
            visible = target and can_view_post(target, actor)
            summary = {"target_type": "life_post", "target_id": target.id, "title": target.title, "target_url": f"/life/post/{target.id}"} if visible else None
        else:
            target = guides.get(row.target_id)
            visible = target and (target.status == "published" or target.author_id == actor.id)
            summary = {"target_type": "game_guide", "target_id": target.id, "title": target.title, "target_url": f"/guide/{target.id}"} if visible else None
        if summary: items.append({**comment_dict(row, actor), "target": summary})
    page, size = args; total = len(items)
    return success_response(items[(page - 1) * size:page * size], meta=meta(page, size, total))
