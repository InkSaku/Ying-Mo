from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.common.responses import error_response, success_response
from app.extensions import db
from app.models import Notification, User
from app.models.content_like import utcnow
from app.models.user import serialize_datetime
from app.users.service import public_user_dict
from . import notifications_bp


def current_user(): return db.session.get(User, int(get_jwt_identity()))
def item_dict(item):
    return {"id": item.id, "type": item.notification_type, "actor": public_user_dict(item.actor) if item.actor else None, "target_type": item.target_type, "target_id": item.target_id, "comment_id": item.comment_id, "payload": item.payload or {}, "is_read": item.read_at is not None, "read_at": serialize_datetime(item.read_at), "created_at": serialize_datetime(item.created_at)}
def paging():
    try: page, size = int(request.args.get("page", 1)), int(request.args.get("page_size", 20))
    except ValueError: return None
    return (page, size) if page >= 1 and 1 <= size <= 100 else None


@notifications_bp.get("")
@jwt_required(locations=["headers"])
def list_notifications():
    actor = current_user(); args = paging(); status = request.args.get("status", "all")
    if not args or status not in {"all", "unread"}: return error_response("VALIDATION_ERROR", "查询参数不合法。", 400)
    page, size = args; stmt = db.select(Notification).where(Notification.recipient_id == actor.id)
    if status == "unread": stmt = stmt.where(Notification.read_at.is_(None))
    total = db.session.scalar(db.select(db.func.count()).select_from(stmt.subquery()))
    items = db.session.scalars(stmt.order_by(Notification.created_at.desc(), Notification.id.desc()).offset((page - 1) * size).limit(size)).all()
    return success_response([item_dict(x) for x in items], meta={"pagination": {"page": page, "page_size": size, "total": total, "total_pages": (total + size - 1) // size, "has_next": page * size < total, "has_previous": page > 1}})


@notifications_bp.get("/unread-count")
@jwt_required(locations=["headers"])
def unread_count():
    count = db.session.scalar(db.select(db.func.count(Notification.id)).where(Notification.recipient_id == current_user().id, Notification.read_at.is_(None)))
    return success_response({"count": count or 0})


@notifications_bp.patch("/<int:notification_id>/read")
@jwt_required(locations=["headers"])
def read(notification_id):
    item = db.session.scalar(db.select(Notification).where(Notification.id == notification_id, Notification.recipient_id == current_user().id))
    if not item: return error_response("RESOURCE_NOT_FOUND", "通知不存在。", 404)
    if item.read_at is None: item.read_at = utcnow(); db.session.commit()
    return success_response(item_dict(item))


@notifications_bp.post("/read-all")
@jwt_required(locations=["headers"])
def read_all():
    result = db.session.execute(db.update(Notification).where(Notification.recipient_id == current_user().id, Notification.read_at.is_(None)).values(read_at=utcnow()))
    db.session.commit(); return success_response({"updated_count": result.rowcount})

