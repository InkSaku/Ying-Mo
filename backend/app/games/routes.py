from flask import Blueprint, current_app, request, url_for
from flask_jwt_extended import jwt_required
from sqlalchemy import case, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload, selectinload

from app.auth.routes import _current_user
from app.auth.service import utcnow
from app.common.responses import error_response, success_response
from app.common.search import escape_like, normalize_search_query
from app.extensions import db
from app.models import Game, GameGuide, GameHero, GameMap
from app.models.user import serialize_datetime
from app.uploads.storage import remove_media_files
from .service import clean_aliases, clean_text, entity_has_conflict, is_catalog_admin, media_url, name_tokens, normalize_name, search_text, slug_for, validate_media


games_bp = Blueprint("games", __name__)
GAME_STATUS = {"active", "inactive"}
REVIEW_STATUS = {"approved", "pending", "rejected"}
MAP_STATUS = {"active", "rotated_out", "retired"}


def _escape_like(value): return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def field_error(field, code, message): return {"field": field, "code": code, "message": message}
def validation_error(details): return error_response("VALIDATION_ERROR", "请求参数不合法。", 422, details)
def page_args():
    try: page, size = int(request.args.get("page", 1)), int(request.args.get("page_size", 20))
    except ValueError: return None, None, validation_error([field_error("page", "invalid_type", "页码必须是整数。")])
    if page < 1 or not 1 <= size <= 100: return None, None, validation_error([field_error("page", "invalid_range", "页码范围不合法。")])
    return page, size, None
def meta(page, size, total): return {"pagination": {"page": page, "page_size": size, "total": total, "total_pages": (total + size - 1) // size, "has_next": page * size < total, "has_previous": page > 1}}
def require_admin():
    user = _current_user()
    return user if is_catalog_admin(user) else None
def game_or_404(slug, public=True):
    stmt = db.select(Game).where(Game.slug == slug)
    if public: stmt = stmt.where(Game.status == "active")
    return db.session.scalar(stmt.options(joinedload(Game.icon_media), joinedload(Game.cover_media)))
def public_game_or_error(slug):
    game = game_or_404(slug, public=False)
    if not game: return None, error_response("RESOURCE_NOT_FOUND", "请求的游戏不存在。", 404)
    if game.status != "active": return None, error_response("GAME_INACTIVE", "这款游戏目录尚未启用。", 409)
    return game, None
def game_ref(game): return {"id": game.id, "name_zh": game.name_zh, "name_en": game.name_en, "slug": game.slug, "status": game.status, "is_available": game.status == "active"}
def entity_ref(item): return {"id": item.id, "game": game_ref(item.game), "name_zh": item.name_zh, "name_en": item.name_en, "slug": item.slug, "aliases": item.aliases or []}
def game_counts(game_ids):
    heroes = dict(db.session.execute(db.select(GameHero.game_id, func.count(GameHero.id)).where(GameHero.game_id.in_(game_ids), GameHero.status == "active", GameHero.review_status == "approved").group_by(GameHero.game_id)).all()) if game_ids else {}
    maps = dict(db.session.execute(db.select(GameMap.game_id, func.count(GameMap.id)).where(GameMap.game_id.in_(game_ids), GameMap.review_status == "approved", GameMap.current_status != "retired").group_by(GameMap.game_id)).all()) if game_ids else {}
    guides = dict(db.session.execute(db.select(GameGuide.game_id, func.count(GameGuide.id)).where(GameGuide.game_id.in_(game_ids), GameGuide.status == "published", GameGuide.guide_scope == "hero_map").group_by(GameGuide.game_id)).all()) if game_ids else {}
    return heroes, maps, guides
def catalog_issues(active_hero_count, usable_map_count):
    issues = []
    if not usable_map_count: issues.append("请先创建至少一张可用地图。")
    if not active_hero_count: issues.append("请先创建至少一位可用英雄。")
    return issues
def game_dict(game, counts=None, detail=False):
    heroes, maps, guides = counts or game_counts([game.id])
    active_hero_count = (heroes or {}).get(game.id, 0)
    usable_map_count = (maps or {}).get(game.id, 0)
    issues = catalog_issues(active_hero_count, usable_map_count)
    data = {"id": game.id, "name_zh": game.name_zh, "name_en": game.name_en, "slug": game.slug, "aliases": game.aliases or [], "icon_url": media_url(game.icon_media), "icon_thumbnail_url": media_url(game.icon_media, True), "cover_url": media_url(game.cover_media), "cover_thumbnail_url": media_url(game.cover_media, True), "description": game.description, "current_version": game.current_version, "status": game.status, "hero_count": active_hero_count, "map_count": usable_map_count, "active_hero_count": active_hero_count, "usable_map_count": usable_map_count, "guide_count": (guides or {}).get(game.id, 0), "catalog_ready": not issues, "catalog_issues": issues, "created_at": serialize_datetime(game.created_at), "updated_at": serialize_datetime(game.updated_at)}
    return data
def hero_dict(hero): return {"id": hero.id, "game": game_ref(hero.game), "name_zh": hero.name_zh, "name_en": hero.name_en, "slug": hero.slug, "aliases": hero.aliases or [], "avatar_url": media_url(hero.avatar_media), "avatar_thumbnail_url": media_url(hero.avatar_media, True), "role": hero.role, "description": hero.description, "status": hero.status, "review_status": hero.review_status, "is_available": hero.game.status == "active" and hero.status == "active" and hero.review_status == "approved", "created_at": serialize_datetime(hero.created_at), "updated_at": serialize_datetime(hero.updated_at)}
def map_dict(game_map, stats=None):
    data = {"id": game_map.id, "game": game_ref(game_map.game), "name_zh": game_map.name_zh, "name_en": game_map.name_en, "slug": game_map.slug, "aliases": game_map.aliases or [], "cover_url": media_url(game_map.cover_media), "cover_thumbnail_url": media_url(game_map.cover_media, True), "map_type": game_map.map_type, "description": game_map.description, "current_status": game_map.current_status, "review_status": game_map.review_status, "is_available": game_map.game.status == "active" and game_map.review_status == "approved" and game_map.current_status != "retired", "created_at": serialize_datetime(game_map.created_at), "updated_at": serialize_datetime(game_map.updated_at)}
    if stats is not None: data.update({"guide_count": stats.get(game_map.id, (0, 0))[0], "hero_with_guides_count": stats.get(game_map.id, (0, 0))[1]})
    return data

def map_stats(map_ids):
    if not map_ids: return {}
    rows = db.session.execute(db.select(GameGuide.map_id, func.count(GameGuide.id), func.count(func.distinct(GameGuide.hero_id))).where(GameGuide.map_id.in_(map_ids), GameGuide.status == "published", GameGuide.guide_scope == "hero_map").group_by(GameGuide.map_id)).all()
    return {map_id: (count, heroes) for map_id, count, heroes in rows}

def catalog_payload(payload, kind, creating=False):
    fields = {"name_zh", "name_en", "aliases", "description", "status", "icon_media_id", "cover_media_id", "current_version"} if kind == "game" else ({"name_zh", "name_en", "aliases", "description", "status", "review_status", "avatar_media_id", "role"} if kind == "hero" else {"name_zh", "name_en", "aliases", "description", "current_status", "review_status", "cover_media_id", "map_type"})
    if not isinstance(payload, dict): return None, validation_error([field_error("body", "invalid_format", "请求体必须是 JSON 对象。")])
    unknown = set(payload) - fields
    if unknown: return None, validation_error([field_error(sorted(unknown)[0], "unknown_field", "不支持该字段。")])
    if creating and "name_zh" not in payload: return None, validation_error([field_error("name_zh", "required", "中文名为必填项。")])
    if not payload: return None, validation_error([field_error("body", "required", "至少提交一个可修改字段。")])
    errors, updates = [], {}
    limits = {"name_zh": 100, "name_en": 120, "description": 2000, "current_version": 50, "role": 80, "map_type": 80}
    for field, maximum in limits.items():
        if field not in payload: continue
        value = clean_text(payload[field])
        if field == "name_zh" and (not value or len(value) > maximum): errors.append(field_error(field, "invalid_length", "中文名长度不合法。"))
        elif value is not None and len(value) > maximum: errors.append(field_error(field, "invalid_length", f"{field} 长度不合法。"))
        else: updates[field] = value or None
    for field, choices in (("status", GAME_STATUS), ("review_status", REVIEW_STATUS), ("current_status", MAP_STATUS)):
        if field in payload:
            if payload[field] not in choices: errors.append(field_error(field, "invalid_choice", "状态值不合法。"))
            else: updates[field] = payload[field]
    if "aliases" in payload:
        try: updates["aliases"] = clean_aliases(payload["aliases"], updates.get("name_zh", ""), updates.get("name_en", ""))
        except ValueError: errors.append(field_error("aliases", "invalid_format", "别名最多 20 个，每项长度为 1 至 80。"))
    for field in {"icon_media_id", "cover_media_id", "avatar_media_id"} & fields:
        if field not in payload: continue
        value = payload[field]
        if value is not None and (not isinstance(value, int) or isinstance(value, bool) or value <= 0): errors.append(field_error(field, "invalid_type", "图片 ID 必须是正整数或 null。"))
        else: updates[field] = value
    return updates, validation_error(errors) if errors else None

@games_bp.get("")
def list_games():
    page, size, error = page_args()
    if error: return error
    stmt = db.select(Game).where(Game.status == "active")
    query = request.args.get("query", "").strip()
    if query:
        try: query = normalize_search_query(query)
        except ValueError as error: return validation_error([field_error("query", "invalid_length", str(error))])
        stmt = stmt.where(Game.search_text.ilike(f"%{escape_like(query)}%", escape="\\"))
    sort = request.args.get("sort", "name")
    if sort not in {"name", "latest"}: return validation_error([field_error("sort", "invalid_choice", "排序方式不支持。")])
    total = db.session.scalar(db.select(func.count()).select_from(stmt.subquery()))
    order = (Game.created_at.desc(), Game.id.desc()) if sort == "latest" else (Game.name_zh.asc(), Game.id.asc())
    games = db.session.scalars(stmt.options(joinedload(Game.icon_media), joinedload(Game.cover_media)).order_by(*order).offset((page - 1) * size).limit(size)).all()
    counts = game_counts([item.id for item in games])
    return success_response([game_dict(game, counts) for game in games], meta=meta(page, size, total))

@games_bp.get("/check-name")
def check_game_name():
    name = request.args.get("name", "")
    token = normalize_name(name)
    if not token: return validation_error([field_error("name", "required", "请输入名称。")])
    pattern = f"%{_escape_like(token)}%"
    games = db.session.scalars(db.select(Game).where(Game.status == "active", Game.search_text.ilike(pattern, escape="\\")).order_by(Game.id.desc()).limit(8)).all()
    candidates = [game for game in games if token in name_tokens(game.name_zh, game.name_en, game.aliases or []) or token in normalize_name(game.search_text)]
    exact = next((game for game in games if token in name_tokens(game.name_zh, game.name_en, game.aliases or [])), None)
    return success_response({"exact_match": game_ref(exact) if exact else None, "candidates": [game_ref(game) for game in candidates]})

@games_bp.get("/<game_slug>")
def get_game(game_slug):
    game, error = public_game_or_error(game_slug)
    if error: return error
    counts = game_counts([game.id]); data = game_dict(game, counts, True)
    heroes = db.session.scalars(db.select(GameHero).where(GameHero.game_id == game.id, GameHero.status == "active", GameHero.review_status == "approved").options(joinedload(GameHero.game), joinedload(GameHero.avatar_media)).order_by(GameHero.created_at.desc(), GameHero.id.desc()).limit(6)).all()
    maps = db.session.scalars(db.select(GameMap).where(GameMap.game_id == game.id, GameMap.review_status == "approved", GameMap.current_status != "retired").options(joinedload(GameMap.game), joinedload(GameMap.cover_media)).order_by(GameMap.created_at.desc(), GameMap.id.desc()).limit(6)).all()
    data.update({"featured_heroes": [hero_dict(item) for item in heroes], "featured_maps": [map_dict(item) for item in maps]})
    return success_response(data)

def list_entities(game_slug, model, kind):
    page, size, error = page_args()
    if error: return error
    game, game_error = public_game_or_error(game_slug)
    if game_error: return game_error
    stmt = db.select(model).where(model.game_id == game.id)
    if kind == "hero": stmt = stmt.where(model.status == "active", model.review_status == "approved")
    else:
        stmt = stmt.where(model.review_status == "approved")
        requested_status = request.args.get("current_status")
        if requested_status:
            if requested_status not in MAP_STATUS: return validation_error([field_error("current_status", "invalid_choice", "地图状态筛选值不合法。")])
            stmt = stmt.where(model.current_status == requested_status)
        else:
            stmt = stmt.where(model.current_status != "retired")
    query = request.args.get("query", "").strip()
    if query:
        try: query = normalize_search_query(query)
        except ValueError as error: return validation_error([field_error("query", "invalid_length", str(error))])
        stmt = stmt.where(model.search_text.ilike(f"%{escape_like(query)}%", escape="\\"))
    for field in (("role",) if kind == "hero" else ("map_type",)):
        value = request.args.get(field[0])
        if value: stmt = stmt.where(getattr(model, field[0]) == value)
    sort = request.args.get("sort", "name")
    if sort not in {"name", "latest"}: return validation_error([field_error("sort", "invalid_choice", "排序方式不支持。")])
    total = db.session.scalar(db.select(func.count()).select_from(stmt.subquery()))
    if sort == "latest":
        order = (model.created_at.desc(), model.id.desc())
    elif kind == "map":
        order = (case((model.current_status == "active", 0), (model.current_status == "rotated_out", 1), else_=2), model.name_zh.asc(), model.id.asc())
    else:
        order = (model.name_zh.asc(), model.id.asc())
    options = (joinedload(model.game), joinedload(model.avatar_media if kind == "hero" else model.cover_media))
    items = db.session.scalars(stmt.options(*options).order_by(*order).offset((page - 1) * size).limit(size)).all()
    stats = map_stats([item.id for item in items]) if kind == "map" else None
    return success_response([hero_dict(item) if kind == "hero" else map_dict(item, stats) for item in items], meta=meta(page, size, total))

@games_bp.get("/<game_slug>/heroes/check-name")
def check_hero_name(game_slug): return check_entity_name(game_slug, GameHero, "hero")
@games_bp.get("/<game_slug>/heroes")
def list_heroes(game_slug): return list_entities(game_slug, GameHero, "hero")
@games_bp.get("/<game_slug>/heroes/<hero_slug>")
def get_hero(game_slug, hero_slug): return get_entity(game_slug, GameHero, hero_slug, "hero")
@games_bp.get("/<game_slug>/maps/check-name")
def check_map_name(game_slug): return check_entity_name(game_slug, GameMap, "map")
@games_bp.get("/<game_slug>/maps")
def list_maps(game_slug): return list_entities(game_slug, GameMap, "map")
@games_bp.get("/<game_slug>/maps/<map_slug>")
def get_map(game_slug, map_slug): return get_entity(game_slug, GameMap, map_slug, "map")


@games_bp.get("/<game_slug>/maps/<map_slug>/heroes")
def list_map_heroes(game_slug, map_slug):
    page, size, error = page_args()
    if error: return error
    game, game_error = public_game_or_error(game_slug)
    if game_error: return game_error
    game_map = db.session.scalar(db.select(GameMap).where(GameMap.game_id == game.id, GameMap.slug == map_slug, GameMap.review_status == "approved"))
    if not game_map: return error_response("RESOURCE_NOT_FOUND", "请求的地图不存在。", 404)
    guides = db.select(GameGuide.hero_id.label("hero_id"), func.count(GameGuide.id).label("guide_count")).where(GameGuide.game_id == game.id, GameGuide.map_id == game_map.id, GameGuide.status == "published", GameGuide.guide_scope == "hero_map").group_by(GameGuide.hero_id).subquery()
    stmt = db.select(GameHero, func.coalesce(guides.c.guide_count, 0).label("guide_count")).outerjoin(guides, guides.c.hero_id == GameHero.id).where(GameHero.game_id == game.id, GameHero.status == "active", GameHero.review_status == "approved")
    query = request.args.get("query", "").strip()
    if query:
        try: query = normalize_search_query(query)
        except ValueError as exc: return validation_error([field_error("query", "invalid_length", str(exc))])
        stmt = stmt.where(GameHero.search_text.ilike(f"%{escape_like(query)}%", escape="\\"))
    role = request.args.get("role")
    if role: stmt = stmt.where(GameHero.role == role)
    with_guides = request.args.get("with_guides")
    if with_guides not in {None, "", "true", "false"}: return validation_error([field_error("with_guides", "invalid_choice", "筛选值不合法。")])
    if with_guides == "true": stmt = stmt.where(func.coalesce(guides.c.guide_count, 0) > 0)
    total = db.session.scalar(db.select(func.count()).select_from(stmt.subquery()))
    rows = db.session.execute(stmt.options(joinedload(GameHero.game), joinedload(GameHero.avatar_media)).order_by(func.coalesce(guides.c.guide_count, 0).desc(), GameHero.name_zh.asc(), GameHero.id.asc()).offset((page - 1) * size).limit(size)).unique().all()
    data = [{**hero_dict(hero), "guide_count": int(count or 0), "has_guides": bool(count)} for hero, count in rows]
    return success_response(data, meta=meta(page, size, total))

def check_entity_name(game_slug, model, kind):
    game, game_error = public_game_or_error(game_slug); token = normalize_name(request.args.get("name", ""))
    if game_error: return game_error
    if not token: return validation_error([field_error("name", "required", "请输入名称。")])
    pattern = f"%{_escape_like(token)}%"
    stmt = db.select(model).where(model.game_id == game.id, model.search_text.ilike(pattern, escape="\\"))
    if kind == "hero": stmt = stmt.where(model.status == "active", model.review_status == "approved")
    else: stmt = stmt.where(model.review_status == "approved", model.current_status != "retired")
    candidates = db.session.scalars(stmt.options(joinedload(model.game), joinedload(model.avatar_media if kind == "hero" else model.cover_media)).order_by(model.id.desc()).limit(8)).all()
    exact = next((item for item in candidates if token in name_tokens(item.name_zh, item.name_en, item.aliases or [])), None)
    return success_response({"exact_match": entity_ref(exact) if exact else None, "candidates": [entity_ref(item) for item in candidates]})

def get_entity(game_slug, model, entity_slug, kind):
    game, game_error = public_game_or_error(game_slug)
    if game_error: return game_error
    stmt = db.select(model).where(model.game_id == game.id, model.slug == entity_slug)
    if kind == "hero": stmt = stmt.where(model.status == "active", model.review_status == "approved"); options = (joinedload(model.game), joinedload(model.avatar_media))
    else: stmt = stmt.where(model.review_status == "approved"); options = (joinedload(model.game), joinedload(model.cover_media))
    item = db.session.scalar(stmt.options(*options))
    return success_response(hero_dict(item) if kind == "hero" else map_dict(item, map_stats([item.id]))) if item else error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)

def write_entity(model, kind, entity=None, game=None):
    user = require_admin()
    if not user: return error_response("PERMISSION_DENIED", "无权维护游戏目录。", 403)
    updates, error = catalog_payload(request.get_json(silent=True), kind, entity is None)
    if error: return error
    if kind == "game" and updates.get("status") == "active" and (entity is None or entity.status != "active"):
        active_hero_count = usable_map_count = 0
        if entity is not None:
            heroes, maps, _guides = game_counts([entity.id])
            active_hero_count = heroes.get(entity.id, 0)
            usable_map_count = maps.get(entity.id, 0)
        issues = catalog_issues(active_hero_count, usable_map_count)
        if issues:
            details = []
            if not usable_map_count: details.append(field_error("maps", "catalog_not_ready", "请先创建至少一张可用地图。"))
            if not active_hero_count: details.append(field_error("heroes", "catalog_not_ready", "请先创建至少一位可用英雄。"))
            return validation_error(details)
    name_zh = updates.get("name_zh", entity.name_zh if entity else "")
    name_en = updates.get("name_en", entity.name_en if entity else None)
    aliases = updates.get("aliases", entity.aliases if entity else [])
    if "aliases" in updates and "name_zh" not in updates and entity: aliases = clean_aliases(aliases, name_zh, name_en)
    tokens = name_tokens(name_zh, name_en, aliases)
    conflict = entity_has_conflict(model, tokens, game.id if game else None, entity.id if entity else None)
    if conflict: return error_response("DUPLICATE_RESOURCE", "名称、英文名或别名与现有目录冲突。", 409)
    media_field = "avatar_media_id" if kind == "hero" else None
    media_fields = [field for field in (["icon_media_id", "cover_media_id"] if kind == "game" else [media_field] if media_field else ["cover_media_id"]) if field in updates]
    media_attribute = {"icon_media_id": "icon_media", "cover_media_id": "cover_media", "avatar_media_id": "avatar_media"}
    try:
        media = {
            field: (
                getattr(entity, media_attribute[field])
                if entity and getattr(entity, field) == updates[field]
                else validate_media(user, updates[field], ())
            ) if updates[field] is not None else None
            for field in media_fields
        }
    except LookupError: return error_response("RESOURCE_NOT_FOUND", "请求的图片不存在。", 404)
    except (ValueError, PermissionError): return error_response("RESOURCE_CONFLICT", "图片不可用于当前目录。", 409)
    if kind == "game" and media.get("icon_media_id") and media.get("cover_media_id") and media["icon_media_id"].id == media["cover_media_id"].id: return validation_error([field_error("cover_media_id", "duplicate", "图标和封面不能使用同一图片。")])
    old_media = []
    try:
        before = {field: getattr(entity, field) for field in updates} if entity else None
        if entity is None:
            entity = model(game_id=game.id, created_by_id=user.id, slug=slug_for(name_zh), **updates) if game else model(created_by_id=user.id, slug=slug_for(name_zh), **updates)
            entity.normalized_name, entity.search_text, entity.aliases = normalize_name(name_zh), search_text(name_zh, name_en, aliases), aliases
            db.session.add(entity); db.session.flush()
        else:
            for field, value in updates.items(): setattr(entity, field, value)
            entity.normalized_name, entity.search_text, entity.aliases, entity.updated_at = normalize_name(name_zh), search_text(name_zh, name_en, aliases), aliases, utcnow()
        bindings = {"icon_media_id": "game_icon", "cover_media_id": "game_cover", "avatar_media_id": "game_hero_avatar" if kind == "hero" else "game_map_cover"}
        for field, item in media.items():
            previous = getattr(entity, field.replace("_id", ""), None)
            if previous and previous.id != (item.id if item else None): old_media.append(previous)
            setattr(entity, field, item.id if item else None)
            if item: item.bound_type, item.bound_id, item.bound_at = bindings[field], entity.id, utcnow()
        for item in old_media: db.session.delete(item)
        from app.admin.audit import create_admin_log
        create_admin_log(user, f"catalog_{kind}_{'created' if before is None else 'updated'}", f"game_{kind}", entity.id, entity.name_zh, before, {field: getattr(entity, field) for field in updates})
        db.session.commit()
    except IntegrityError:
        db.session.rollback(); return error_response("DUPLICATE_RESOURCE", "目录名称冲突。", 409)
    except Exception:
        db.session.rollback(); current_app.logger.exception("Unable to save catalog entity"); return error_response("INTERNAL_ERROR", "目录保存失败，请稍后重试。", 500)
    for item in old_media: remove_media_files(item)
    refreshed = db.session.get(model, entity.id)
    return success_response(game_dict(refreshed, game_counts([refreshed.id])), 201 if request.method == "POST" else 200) if kind == "game" else success_response(hero_dict(refreshed) if kind == "hero" else map_dict(refreshed), 201 if request.method == "POST" else 200)

@games_bp.post("")
@jwt_required(locations=["headers"])
def create_game(): return write_entity(Game, "game")
@games_bp.patch("/<int:game_id>")
@jwt_required(locations=["headers"])
def update_game(game_id):
    entity = db.session.get(Game, game_id)
    return write_entity(Game, "game", entity) if entity else error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
@games_bp.post("/<int:game_id>/heroes")
@jwt_required(locations=["headers"])
def create_hero(game_id):
    game = db.session.get(Game, game_id)
    return write_entity(GameHero, "hero", game=game) if game else error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
@games_bp.patch("/<int:game_id>/heroes/<int:hero_id>")
@jwt_required(locations=["headers"])
def update_hero(game_id, hero_id):
    entity = db.session.get(GameHero, hero_id)
    return write_entity(GameHero, "hero", entity, entity.game if entity and entity.game_id == game_id else None) if entity and entity.game_id == game_id else error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
@games_bp.post("/<int:game_id>/maps")
@jwt_required(locations=["headers"])
def create_map(game_id):
    game = db.session.get(Game, game_id)
    return write_entity(GameMap, "map", game=game) if game else error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
@games_bp.patch("/<int:game_id>/maps/<int:map_id>")
@jwt_required(locations=["headers"])
def update_map(game_id, map_id):
    entity = db.session.get(GameMap, map_id)
    return write_entity(GameMap, "map", entity, entity.game if entity and entity.game_id == game_id else None) if entity and entity.game_id == game_id else error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
