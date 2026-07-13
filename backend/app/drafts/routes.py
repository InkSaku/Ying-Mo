from flask import Blueprint, current_app, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func
from sqlalchemy.orm import selectinload

from app.auth.routes import _current_user
from app.auth.service import utcnow
from app.common.responses import error_response, success_response
from app.extensions import db
from app.models import ContentDraft, ContentDraftMedia

from .service import DRAFT_TYPES, can_save_drafts, cleanup_media, draft_dict, touch_draft, validate_draft_media, validate_payload


drafts_bp = Blueprint("drafts", __name__)
OPTIONS = (selectinload(ContentDraft.media_links).selectinload(ContentDraftMedia.media),)


def _error(message, status=422, code="VALIDATION_ERROR"):
    return error_response(code, message, status)


def _page_args():
    try:
        page, page_size = int(request.args.get("page", 1)), int(request.args.get("page_size", 20))
    except ValueError:
        return None, None, _error("页码必须是整数。")
    if page < 1 or not 1 <= page_size <= 100:
        return None, None, _error("页码范围不合法。")
    return page, page_size, None


def _meta(page, page_size, total):
    return {"pagination": {"page": page, "page_size": page_size, "total": total, "total_pages": (total + page_size - 1) // page_size, "has_next": page * page_size < total, "has_previous": page > 1}}


def _owned_draft(draft_id, user):
    return db.session.scalar(db.select(ContentDraft).where(ContentDraft.id == draft_id, ContentDraft.owner_id == user.id).options(*OPTIONS))


def _payload_and_media(data, existing=None):
    if not isinstance(data, dict) or set(data) - {"draft_type", "payload", "media_ids"}:
        raise ValueError("请求体不合法。")
    draft_type = data.get("draft_type", existing.draft_type if existing else None)
    if draft_type not in DRAFT_TYPES:
        raise ValueError("草稿类型不合法。")
    if "payload" not in data or not isinstance(data["payload"], dict):
        raise ValueError("payload 必须是对象。")
    return draft_type, validate_payload(draft_type, data["payload"]), data.get("media_ids", [link.media_id for link in existing.media_links] if existing else [])


@drafts_bp.get("")
@jwt_required(locations=["headers"])
def list_drafts():
    user = _current_user()
    page, page_size, error = _page_args()
    if error:
        return error
    kind = request.args.get("draft_type", "all")
    if kind not in {"all", *DRAFT_TYPES}:
        return _error("草稿类型不合法。")
    stmt = db.select(ContentDraft).where(ContentDraft.owner_id == user.id)
    if kind != "all":
        stmt = stmt.where(ContentDraft.draft_type == kind)
    total = db.session.scalar(db.select(func.count()).select_from(stmt.subquery()))
    drafts = db.session.scalars(stmt.options(*OPTIONS).order_by(ContentDraft.updated_at.desc(), ContentDraft.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return success_response([draft_dict(draft) for draft in drafts], meta=_meta(page, page_size, total))


@drafts_bp.post("")
@jwt_required(locations=["headers"])
def create_draft():
    user = _current_user()
    if not can_save_drafts(user):
        return _error("当前账号不能保存草稿。", 403, "PERMISSION_DENIED")
    try:
        draft_type, payload, media_ids = _payload_and_media(request.get_json(silent=True))
        maximum = 9 if draft_type == "life_post" else 20
        if len(media_ids) > maximum:
            raise ValueError("草稿图片数量超出限制。")
        media = validate_draft_media(user, media_ids)
    except LookupError:
        return _error("请求的图片不存在。", 404, "RESOURCE_NOT_FOUND")
    except PermissionError:
        return _error("图片不可用于当前草稿。", 409, "RESOURCE_CONFLICT")
    except ValueError as error:
        return _error(str(error))
    draft = ContentDraft(owner_id=user.id, draft_type=draft_type, title_cache=(payload.get("title") or None), payload=payload)
    try:
        db.session.add(draft)
        db.session.flush()
        for position, item in enumerate(media):
            db.session.add(ContentDraftMedia(draft_id=draft.id, media_id=item.id, position=position))
            item.bound_type, item.bound_id, item.bound_at = "content_draft", draft.id, utcnow()
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Unable to create content draft")
        return _error("草稿保存失败，请稍后重试。", 500, "INTERNAL_ERROR")
    draft = _owned_draft(draft.id, user)
    return success_response(draft_dict(draft, True), 201)


@drafts_bp.get("/<int:draft_id>")
@jwt_required(locations=["headers"])
def get_draft(draft_id):
    draft = _owned_draft(draft_id, _current_user())
    return success_response(draft_dict(draft, True)) if draft else _error("请求的资源不存在。", 404, "RESOURCE_NOT_FOUND")


@drafts_bp.patch("/<int:draft_id>")
@jwt_required(locations=["headers"])
def update_draft(draft_id):
    user = _current_user()
    draft = _owned_draft(draft_id, user)
    if not draft:
        return _error("请求的资源不存在。", 404, "RESOURCE_NOT_FOUND")
    if not can_save_drafts(user):
        return _error("当前账号不能更新草稿。", 403, "PERMISSION_DENIED")
    try:
        draft_type, payload, media_ids = _payload_and_media(request.get_json(silent=True), draft)
        if draft_type != draft.draft_type:
            raise ValueError("不能修改草稿类型。")
        if len(media_ids) > (9 if draft_type == "life_post" else 20):
            raise ValueError("草稿图片数量超出限制。")
        old = {link.media_id: link.media for link in draft.media_links}
        media = validate_draft_media(user, media_ids, old)
    except LookupError:
        return _error("请求的图片不存在。", 404, "RESOURCE_NOT_FOUND")
    except PermissionError:
        return _error("图片不可用于当前草稿。", 409, "RESOURCE_CONFLICT")
    except ValueError as error:
        return _error(str(error))
    removed = [item for media_id, item in old.items() if media_id not in media_ids]
    try:
        for link in list(draft.media_links):
            db.session.delete(link)
        db.session.flush()
        for position, item in enumerate(media):
            db.session.add(ContentDraftMedia(draft_id=draft.id, media_id=item.id, position=position))
            item.bound_type, item.bound_id, item.bound_at = "content_draft", draft.id, utcnow()
        for item in removed:
            db.session.delete(item)
        draft.payload, draft.title_cache = payload, payload.get("title") or None
        touch_draft(draft)
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Unable to update content draft")
        return _error("草稿保存失败，请稍后重试。", 500, "INTERNAL_ERROR")
    cleanup_media(removed)
    return success_response(draft_dict(_owned_draft(draft.id, user), True))


@drafts_bp.delete("/<int:draft_id>")
@jwt_required(locations=["headers"])
def remove_draft(draft_id):
    draft = _owned_draft(draft_id, _current_user())
    if not draft:
        return _error("请求的资源不存在。", 404, "RESOURCE_NOT_FOUND")
    media = [link.media for link in draft.media_links]
    try:
        db.session.delete(draft)
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Unable to delete content draft")
        return _error("草稿删除失败，请稍后重试。", 500, "INTERNAL_ERROR")
    cleanup_media(media)
    return "", 204
