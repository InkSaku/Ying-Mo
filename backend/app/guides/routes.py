from flask import Blueprint, current_app, request, url_for
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import case, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload, selectinload

from app.auth.routes import _current_user
from app.auth.service import utcnow
from app.common.responses import error_response, success_response
from app.common.search import escape_like, normalize_search_query
from app.extensions import db
from app.models import ContentFavorite, ContentLike, Game, GameGuide, GameGuideStep, GameHero, GameMap, GuideValidityFeedback, Notification
from .serializers import guide_dict
from .service import CATEGORIES, CONTENT_MODES, SIDES, VALIDITIES, CatalogSelectionError, can_publish, clean_date, clean_tags, clean_video, field_error, remove_files, searchable, text, validate_scope, validate_steps

guides_bp = Blueprint("guides", __name__)
GUIDE_OPTIONS = (joinedload(GameGuide.author), joinedload(GameGuide.game), joinedload(GameGuide.hero).joinedload(GameHero.avatar_media), joinedload(GameGuide.game_map).joinedload(GameMap.cover_media), selectinload(GameGuide.steps).joinedload(GameGuideStep.media), selectinload(GameGuide.validity_feedback))
def validation(details): return error_response("VALIDATION_ERROR", "请求参数不合法。", 422, details)
def page_args():
    try: page, size = int(request.args.get("page", 1)), int(request.args.get("page_size", 20))
    except ValueError: return None, None, validation([field_error("page", "invalid_type", "页码必须是整数。")])
    if page < 1 or not 1 <= size <= 100: return None, None, validation([field_error("page", "invalid_range", "页码范围不合法。")])
    return page, size, None
def meta(page, size, total): return {"pagination": {"page": page, "page_size": size, "total": total, "total_pages": (total + size - 1) // size, "has_next": page * size < total, "has_previous": page > 1}}
def optional_user(): return _current_user() if get_jwt_identity() else None
def interaction_counts(guide_ids):
    result = {guide_id: {"like_count": 0, "favorite_count": 0} for guide_id in guide_ids}
    if not guide_ids: return result
    for model, field in ((ContentLike, "like_count"), (ContentFavorite, "favorite_count")):
        rows = db.session.execute(db.select(model.target_id, func.count(model.id)).where(model.target_type == "game_guide", model.target_id.in_(guide_ids)).group_by(model.target_id)).all()
        for guide_id, count in rows: result[guide_id][field] = int(count or 0)
    return result

def guide_payload(payload, existing=None, creating=False):
    fields = {"game_id", "hero_id", "map_id", "guide_scope", "content_mode", "title", "category", "instructions", "map_area", "side", "skill", "aim_reference", "timing", "game_version", "tags", "notes", "video_url", "tested_at", "validity_note", "steps"}
    if not isinstance(payload, dict): return None, validation([field_error("body", "invalid_format", "请求体必须是 JSON 对象。")])
    if "validity_status" in payload: return None, error_response("PERMISSION_DENIED", "教材有效状态只能由管理员修改。", 403)
    unknown = set(payload) - fields
    if unknown: return None, validation([field_error(sorted(unknown)[0], "unknown_field", "不支持该字段。")])
    required = {"game_id", "hero_id", "map_id", "title", "category", "instructions"}
    if creating and required - set(payload):
        labels = {"game_id": "请选择游戏。", "map_id": "请选择地图。", "hero_id": "请选择英雄。", "title": "请填写点位标题。", "category": "请选择点位分类。", "instructions": "请填写详细说明。"}
        return None, validation([field_error(field, "required", labels[field]) for field in sorted(required - set(payload))])
    if not payload: return None, validation([field_error("body", "required", "至少提交一个可修改字段。")])
    updates, errors = {}, []
    for field, maximum, required_text in (("title", 120, True), ("instructions", 10000, True), ("map_area", 120, False), ("skill", 120, False), ("aim_reference", 500, False), ("timing", 500, False), ("game_version", 50, False), ("notes", 5000, False), ("validity_note", 1000, False)):
        if field in payload:
            try: updates[field] = text(payload[field], maximum, required_text)
            except ValueError: errors.append(field_error(field, "required" if required_text and not payload[field] else "invalid_format", "该字段不能为空。" if required_text and not payload[field] else "字段格式或长度不合法。"))
    if "tags" in payload:
        try: updates["tags"] = clean_tags(payload["tags"])
        except ValueError: errors.append(field_error("tags", "invalid_format", "标签格式或数量不合法。"))
    if "video_url" in payload:
        try: updates["video_url"] = clean_video(payload["video_url"])
        except ValueError: errors.append(field_error("video_url", "invalid_url", "请输入合法的 http 或 https 外部视频链接。"))
    if "tested_at" in payload:
        try: updates["tested_at"] = clean_date(payload["tested_at"])
        except ValueError: errors.append(field_error("tested_at", "invalid_date", "测试日期格式不合法。"))
    for field, choices in (("category", CATEGORIES), ("side", SIDES), ("content_mode", CONTENT_MODES)):
        if field in payload:
            if payload[field] not in choices and field != "side": errors.append(field_error(field, "invalid_choice", "枚举值不合法。"))
            elif field == "side" and payload[field] is not None and payload[field] not in choices: errors.append(field_error(field, "invalid_choice", "枚举值不合法。"))
            else: updates[field] = payload[field]
    for field in ("game_id", "hero_id", "map_id"):
        if field in payload:
            value = payload[field]
            if creating and value is None: errors.append(field_error(field, "required", "请选择对应目录。"))
            elif value is not None and (not isinstance(value, int) or isinstance(value, bool) or value <= 0): errors.append(field_error(field, "invalid_type", "ID 必须是正整数或 null。"))
            else: updates[field] = value
    if "guide_scope" in payload and payload["guide_scope"] != "hero_map": errors.append(field_error("guide_scope", "invalid_scope", "新版点位必须同时关联地图和英雄。"))
    updates["guide_scope"] = "hero_map"
    if "steps" in payload: updates["steps"] = payload["steps"]
    if errors: return None, validation(errors)
    return updates, None

def save_guide(user, guide, updates, creating, draft=None):
    data = dict(updates); steps_payload = data.pop("steps", None)
    try: validate_scope(data, guide, creating)
    except ValueError: return None, validation([field_error("guide_scope", "invalid_scope", "教材范围与英雄、地图选择不匹配。")])
    except CatalogSelectionError as error: return None, validation([field_error(error.field, error.code, error.message)])
    draft_media_ids = {link.media_id for link in draft.media_links} if draft else ()
    content_mode = data.get("content_mode", guide.content_mode if guide else "simple")
    try: steps = validate_steps(user, steps_payload, content_mode, guide.steps if guide and steps_payload is not None else (), draft_media_ids) if steps_payload is not None else None
    except ValueError: return None, validation([field_error("steps", "invalid_format", "图片最多 20 张，且不能重复绑定。")])
    except LookupError: return None, error_response("RESOURCE_NOT_FOUND", "步骤图片不存在。", 404, [field_error("steps", "not_found", "步骤图片不存在。")])
    except PermissionError: return None, error_response("RESOURCE_CONFLICT", "步骤图片不可用于当前教材。", 409, [field_error("steps", "ownership", "步骤图片不属于当前用户或已被其他内容使用。")])
    if creating: guide = GameGuide(author_id=user.id, status="published", **data); guide.search_text = searchable([guide.title, guide.instructions, guide.map_area, guide.skill, guide.aim_reference, guide.timing, guide.notes, *(guide.tags or [])])
    else:
        for field, value in data.items(): setattr(guide, field, value)
        guide.search_text, guide.updated_at = searchable([guide.title, guide.instructions, guide.map_area, guide.skill, guide.aim_reference, guide.timing, guide.notes, *(guide.tags or [])]), utcnow()
    final_image_count = len(steps) if steps is not None else len(guide.steps)
    if not final_image_count and not guide.video_url:
        return None, validation([field_error("visualization", "required", "请至少上传一张图片或填写合法外部视频链接。")])
    if guide.category == "timed_throw" and not guide.timing:
        return None, validation([field_error("timing", "required", "开局定时投掷必须填写投掷时间或时机。")])
    if guide.validity_status != "unverified" and (creating or "validity_status" in data): guide.last_confirmed_at = utcnow()
    removed = []
    unused_draft_media = []
    try:
        if creating: db.session.add(guide); db.session.flush()
        if steps is not None:
            old = {step.media_id: step for step in guide.steps}
            removed = [step.media for media_id, step in old.items() if media_id not in {item[0].id for item in steps}]
            for step in list(guide.steps): db.session.delete(step)
            db.session.flush()
            for position, (media, title, description) in enumerate(steps):
                step = GameGuideStep(guide_id=guide.id, media_id=media.id, position=position, title=title, description=description); db.session.add(step); db.session.flush(); media.bound_type, media.bound_id, media.bound_at = "game_guide_step", step.id, utcnow()
            for media in removed: db.session.delete(media)
        if draft:
            selected = {item[0].id for item in (steps or ())}
            unused_draft_media = [link.media for link in draft.media_links if link.media_id not in selected]
            db.session.delete(draft)
            for media in unused_draft_media: db.session.delete(media)
        db.session.commit()
    except Exception:
        db.session.rollback(); current_app.logger.exception("Unable to save game guide"); return None, error_response("INTERNAL_ERROR", "教材保存失败，请稍后重试。", 500)
    remove_files([*removed, *unused_draft_media])
    return guide, None

@guides_bp.get("")
def list_guides():
    page, size, error = page_args()
    if error: return error
    stmt = db.select(GameGuide).where(GameGuide.status == "published", GameGuide.guide_scope == "hero_map")
    query = request.args.get("query", "").strip()
    if query:
        try: query = normalize_search_query(query)
        except ValueError as error: return validation([field_error("query", "invalid_length", str(error))])
        stmt = stmt.where(GameGuide.search_text.ilike(f"%{escape_like(query)}%", escape="\\"))
    game_slug = request.args.get("game_slug"); hero_slug = request.args.get("hero_slug"); map_slug = request.args.get("map_slug")
    if game_slug:
        game = db.session.scalar(db.select(Game).where(Game.slug == game_slug))
        if not game: return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
        if game.status != "active" and not (hero_slug and map_slug): return error_response("GAME_INACTIVE", "这款游戏目录尚未启用。", 409)
        stmt = stmt.where(GameGuide.game_id == game.id)
        if hero_slug:
            hero = db.session.scalar(db.select(GameHero).where(GameHero.game_id == game.id, GameHero.slug == hero_slug))
            if not hero: return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
            stmt = stmt.where(GameGuide.hero_id == hero.id)
        if map_slug:
            game_map = db.session.scalar(db.select(GameMap).where(GameMap.game_id == game.id, GameMap.slug == map_slug))
            if not game_map: return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
            stmt = stmt.where(GameGuide.map_id == game_map.id)
    elif hero_slug or map_slug: return validation([field_error("game_slug", "required", "筛选英雄或地图时必须同时指定游戏。")])
    if bool(hero_slug) != bool(map_slug): return validation([field_error("map_slug", "required", "地图和英雄点位查询必须同时指定地图和英雄。")])
    for field, choices in (("category", CATEGORIES), ("side", SIDES), ("validity_status", VALIDITIES)):
        value = request.args.get(field)
        if value:
            if value not in choices: return validation([field_error(field, "invalid_choice", "筛选值不合法。")])
            stmt = stmt.where(getattr(GameGuide, field) == value)
    version = request.args.get("game_version"); author = request.args.get("author_username"); tag = request.args.get("tag"); map_area = request.args.get("map_area")
    if version: stmt = stmt.where(GameGuide.game_version == version)
    if author: stmt = stmt.join(GameGuide.author).where(GameGuide.author.has(username_normalized=author.casefold()))
    if tag: stmt = stmt.where(GameGuide.tags.contains([tag]))
    if map_area: stmt = stmt.where(GameGuide.map_area == map_area)
    sort = request.args.get("sort", "updated" if hero_slug and map_slug else "latest")
    if sort not in {"latest", "updated", "popular"}: return validation([field_error("sort", "invalid_choice", "排序方式不支持。")])
    total = db.session.scalar(db.select(func.count()).select_from(stmt.subquery()))
    if sort == "popular":
        likes = db.select(ContentLike.target_id, func.count(ContentLike.id).label("count")).where(ContentLike.target_type == "game_guide").group_by(ContentLike.target_id).subquery()
        favorites = db.select(ContentFavorite.target_id, func.count(ContentFavorite.id).label("count")).where(ContentFavorite.target_type == "game_guide").group_by(ContentFavorite.target_id).subquery()
        stmt = stmt.outerjoin(likes, likes.c.target_id == GameGuide.id).outerjoin(favorites, favorites.c.target_id == GameGuide.id)
        order = (case((GameGuide.validity_status == "invalid", 1), else_=0), func.coalesce(likes.c.count, 0).desc(), func.coalesce(favorites.c.count, 0).desc(), GameGuide.updated_at.desc(), GameGuide.id.desc())
    else:
        date_order = GameGuide.updated_at.desc() if sort == "updated" else GameGuide.created_at.desc()
        order = (case((GameGuide.validity_status == "invalid", 1), else_=0), date_order, GameGuide.id.desc())
    items = db.session.scalars(stmt.options(*GUIDE_OPTIONS).order_by(*order).offset((page - 1) * size).limit(size)).unique().all()
    counts = interaction_counts([item.id for item in items])
    return success_response([guide_dict(item, interaction_counts=counts[item.id]) for item in items], meta=meta(page, size, total))

@guides_bp.get("/<int:guide_id>")
@jwt_required(optional=True, locations=["headers"])
def get_guide(guide_id):
    guide = db.session.scalar(db.select(GameGuide).where(GameGuide.id == guide_id).options(*GUIDE_OPTIONS)); user = optional_user()
    if not guide or (guide.status != "published" and (not user or guide.author_id != user.id)): return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    return success_response(guide_dict(guide, user, True, interaction_counts([guide.id])[guide.id]))

@guides_bp.post("")
@jwt_required(locations=["headers"])
def create_guide():
    user = _current_user()
    if not can_publish(user): return error_response("PERMISSION_DENIED", "当前账号不能发布教材。", 403)
    payload = request.get_json(silent=True)
    draft_id = payload.get("draft_id") if isinstance(payload, dict) else None
    if draft_id is not None:
        if not isinstance(draft_id, int) or isinstance(draft_id, bool) or draft_id <= 0: return validation([field_error("draft_id", "invalid_type", "draft_id 必须是正整数。")])
        payload = dict(payload); payload.pop("draft_id")
    updates, error = guide_payload(payload, creating=True)
    if error: return error
    draft = None
    if draft_id is not None:
        from app.models import ContentDraft
        from app.models.content_draft_media import ContentDraftMedia
        draft = db.session.scalar(db.select(ContentDraft).where(ContentDraft.id == draft_id, ContentDraft.owner_id == user.id, ContentDraft.draft_type == "game_guide").options(selectinload(ContentDraft.media_links).joinedload(ContentDraftMedia.media)))
        if not draft: return error_response("RESOURCE_NOT_FOUND", "请求的草稿不存在。", 404)
    guide, error = save_guide(user, None, updates, True, draft)
    if error: return error
    guide = db.session.scalar(db.select(GameGuide).where(GameGuide.id == guide.id).options(*GUIDE_OPTIONS))
    return success_response(guide_dict(guide, user, True, interaction_counts([guide.id])[guide.id]), 201, {"location": url_for("guides.get_guide", guide_id=guide.id)})

@guides_bp.patch("/<int:guide_id>")
@jwt_required(locations=["headers"])
def update_guide(guide_id):
    user = _current_user(); guide = db.session.scalar(db.select(GameGuide).where(GameGuide.id == guide_id).options(*GUIDE_OPTIONS))
    if not guide: return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    if not user or guide.author_id != user.id: return error_response("PERMISSION_DENIED", "无权编辑该教材。", 403)
    updates, error = guide_payload(request.get_json(silent=True), guide)
    if error: return error
    guide, error = save_guide(user, guide, updates, False)
    if error: return error
    guide = db.session.scalar(db.select(GameGuide).where(GameGuide.id == guide.id).options(*GUIDE_OPTIONS)); return success_response(guide_dict(guide, user, True, interaction_counts([guide.id])[guide.id]))


@guides_bp.put("/<int:guide_id>/validity-feedback")
@jwt_required(locations=["headers"])
def upsert_validity_feedback(guide_id):
    user = _current_user(); payload = request.get_json(silent=True) or {}
    feedback_type = payload.get("feedback_type")
    if feedback_type not in {"valid", "possibly_invalid"}:
        return validation([field_error("feedback_type", "invalid_choice", "反馈类型不合法。")])
    guide = db.session.scalar(db.select(GameGuide).where(GameGuide.id == guide_id, GameGuide.status == "published", GameGuide.guide_scope == "hero_map").options(*GUIDE_OPTIONS))
    if not guide: return error_response("RESOURCE_NOT_FOUND", "请求的点位不存在。", 404)
    item = db.session.scalar(db.select(GuideValidityFeedback).where(GuideValidityFeedback.guide_id == guide.id, GuideValidityFeedback.user_id == user.id))
    if item and item.feedback_type == feedback_type:
        return error_response("DUPLICATE_FEEDBACK", "你已经提交过相同的有效性反馈。", 409, [field_error("feedback_type", "duplicate", "相同类型的反馈不能重复提交。")])
    changed = not item or item.feedback_type != feedback_type
    if item: item.feedback_type, item.updated_at = feedback_type, utcnow()
    else:
        item = GuideValidityFeedback(guide_id=guide.id, user_id=user.id, feedback_type=feedback_type); db.session.add(item)
    try:
        if changed and guide.author_id != user.id:
            dedupe_key = f"guide-feedback:{guide.id}:{user.id}"
            notification = db.session.scalar(db.select(Notification).where(Notification.dedupe_key == dedupe_key))
            if notification:
                notification.actor_id, notification.payload, notification.read_at, notification.created_at = user.id, {"feedback_type": feedback_type, "guide_title": guide.title}, None, utcnow()
            else:
                db.session.add(Notification(recipient_id=guide.author_id, actor_id=user.id, notification_type="guide_validity_feedback", target_type="game_guide", target_id=guide.id, dedupe_key=dedupe_key, payload={"feedback_type": feedback_type, "guide_title": guide.title}))
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return error_response("DUPLICATE_FEEDBACK", "你已经提交过有效性反馈。", 409, [field_error("feedback_type", "duplicate", "不能重复提交相同点位反馈。")])
    except Exception:
        db.session.rollback(); current_app.logger.exception("Unable to save guide validity feedback"); return error_response("INTERNAL_ERROR", "有效性反馈保存失败，请稍后重试。", 500)
    guide = db.session.scalar(db.select(GameGuide).where(GameGuide.id == guide.id).options(*GUIDE_OPTIONS))
    return success_response(guide_dict(guide, user, True, interaction_counts([guide.id])[guide.id]))

@guides_bp.delete("/<int:guide_id>")
@jwt_required(locations=["headers"])
def delete_guide(guide_id):
    from app.interactions.targets import cleanup_target_interactions
    user = _current_user(); guide = db.session.scalar(db.select(GameGuide).where(GameGuide.id == guide_id).options(*GUIDE_OPTIONS))
    if not guide: return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    if not user or guide.author_id != user.id: return error_response("PERMISSION_DENIED", "无权删除该教材。", 403)
    media = [step.media for step in guide.steps]
    try:
        cleanup_target_interactions("game_guide", guide.id)
        from app.moderation.service import close_open_reports_for_target
        close_open_reports_for_target("game_guide", guide.id)
        for step in list(guide.steps): db.session.delete(step)
        db.session.flush()
        for item in media: db.session.delete(item)
        db.session.delete(guide); db.session.commit()
    except Exception:
        db.session.rollback(); current_app.logger.exception("Unable to delete game guide"); return error_response("INTERNAL_ERROR", "教材删除失败，请稍后重试。", 500)
    remove_files(media); return "", 204
