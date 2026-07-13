from flask import Blueprint, current_app, request, url_for
from flask_jwt_extended import jwt_required
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload, selectinload

from app.auth.routes import _current_user
from app.auth.service import utcnow
from app.common.responses import error_response, success_response
from app.common.search import escape_like, normalize_search_query
from app.extensions import db
from app.models import Game, GameHero, GameMap
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
def game_ref(game): return {"id": game.id, "name_zh": game.name_zh, "name_en": game.name_en, "slug": game.slug}
def entity_ref(item): return {"id": item.id, "game": game_ref(item.game), "name_zh": item.name_zh, "name_en": item.name_en, "slug": item.slug, "aliases": item.aliases or []}
def game_counts(game_ids):
    heroes = dict(db.session.execute(db.select(GameHero.game_id, func.count(GameHero.id)).where(GameHero.game_id.in_(game_ids), GameHero.status == "active", GameHero.review_status == "approved").group_by(GameHero.game_id)).all()) if game_ids else {}
    maps = dict(db.session.execute(db.select(GameMap.game_id, func.count(GameMap.id)).where(GameMap.game_id.in_(game_ids), GameMap.review_status == "approved", GameMap.current_status != "retired").group_by(GameMap.game_id)).all()) if game_ids else {}
    return heroes, maps
def game_dict(game, counts=(None, None), detail=False):
    heroes, maps = counts
    data = {"id": game.id, "name_zh": game.name_zh, "name_en": game.name_en, "slug": game.slug, "aliases": game.aliases or [], "icon_url": media_url(game.icon_media), "icon_thumbnail_url": media_url(game.icon_media, True), "cover_url": media_url(game.cover_media), "cover_thumbnail_url": media_url(game.cover_media, True), "description": game.description, "current_version": game.current_version, "status": game.status, "hero_count": (heroes or {}).get(game.id, 0), "map_count": (maps or {}).get(game.id, 0), "created_at": serialize_datetime(game.created_at), "updated_at": serialize_datetime(game.updated_at)}
    return data
def hero_dict(hero): return {"id": hero.id, "game": game_ref(hero.game), "name_zh": hero.name_zh, "name_en": hero.name_en, "slug": hero.slug, "aliases": hero.aliases or [], "avatar_url": media_url(hero.avatar_media), "avatar_thumbnail_url": media_url(hero.avatar_media, True), "role": hero.role, "description": hero.description, "status": hero.status, "review_status": hero.review_status, "created_at": serialize_datetime(hero.created_at), "updated_at": serialize_datetime(hero.updated_at)}
def map_dict(game_map): return {"id": game_map.id, "game": game_ref(game_map.game), "name_zh": game_map.name_zh, "name_en": game_map.name_en, "slug": game_map.slug, "aliases": game_map.aliases or [], "cover_url": media_url(game_map.cover_media), "cover_thumbnail_url": media_url(game_map.cover_media, True), "map_type": game_map.map_type, "description": game_map.description, "current_status": game_map.current_status, "review_status": game_map.review_status, "created_at": serialize_datetime(game_map.created_at), "updated_at": serialize_datetime(game_map.updated_at)}

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
    return success_response([game_dict(game, game_counts([item.id for item in games])) for game in games], meta=meta(page, size, total))

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
    game = game_or_404(game_slug)
    if not game: return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    counts = game_counts([game.id]); data = game_dict(game, counts, True)
    heroes = db.session.scalars(db.select(GameHero).where(GameHero.game_id == game.id, GameHero.status == "active", GameHero.review_status == "approved").options(joinedload(GameHero.game), joinedload(GameHero.avatar_media)).order_by(GameHero.created_at.desc(), GameHero.id.desc()).limit(6)).all()
    maps = db.session.scalars(db.select(GameMap).where(GameMap.game_id == game.id, GameMap.review_status == "approved", GameMap.current_status != "retired").options(joinedload(GameMap.game), joinedload(GameMap.cover_media)).order_by(GameMap.created_at.desc(), GameMap.id.desc()).limit(6)).all()
    data.update({"featured_heroes": [hero_dict(item) for item in heroes], "featured_maps": [map_dict(item) for item in maps]})
    return success_response(data)

def list_entities(game_slug, model, kind):
    page, size, error = page_args()
    if error: return error
    game = game_or_404(game_slug)
    if not game: return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    stmt = db.select(model).where(model.game_id == game.id)
    if kind == "hero": stmt = stmt.where(model.status == "active", model.review_status == "approved")
    else: stmt = stmt.where(model.review_status == "approved", model.current_status != "retired")
    query = request.args.get("query", "").strip()
    if query:
        try: query = normalize_search_query(query)
        except ValueError as error: return validation_error([field_error("query", "invalid_length", str(error))])
        stmt = stmt.where(model.search_text.ilike(f"%{escape_like(query)}%", escape="\\"))
    for field in (("role",) if kind == "hero" else ("map_type", "current_status")):
        value = request.args.get(field[0])
        if value: stmt = stmt.where(getattr(model, field[0]) == value)
    sort = request.args.get("sort", "name")
    if sort not in {"name", "latest"}: return validation_error([field_error("sort", "invalid_choice", "排序方式不支持。")])
    total = db.session.scalar(db.select(func.count()).select_from(stmt.subquery()))
    order = (model.created_at.desc(), model.id.desc()) if sort == "latest" else (model.name_zh.asc(), model.id.asc())
    options = (joinedload(model.game), joinedload(model.avatar_media if kind == "hero" else model.cover_media))
    items = db.session.scalars(stmt.options(*options).order_by(*order).offset((page - 1) * size).limit(size)).all()
    return success_response([hero_dict(item) if kind == "hero" else map_dict(item) for item in items], meta=meta(page, size, total))

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

def check_entity_name(game_slug, model, kind):
    game = game_or_404(game_slug); token = normalize_name(request.args.get("name", ""))
    if not game: return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    if not token: return validation_error([field_error("name", "required", "请输入名称。")])
    pattern = f"%{_escape_like(token)}%"
    stmt = db.select(model).where(model.game_id == game.id, model.search_text.ilike(pattern, escape="\\"))
    if kind == "hero": stmt = stmt.where(model.status == "active", model.review_status == "approved")
    else: stmt = stmt.where(model.review_status == "approved", model.current_status != "retired")
    candidates = db.session.scalars(stmt.options(joinedload(model.game), joinedload(model.avatar_media if kind == "hero" else model.cover_media)).order_by(model.id.desc()).limit(8)).all()
    exact = next((item for item in candidates if token in name_tokens(item.name_zh, item.name_en, item.aliases or [])), None)
    return success_response({"exact_match": entity_ref(exact) if exact else None, "candidates": [entity_ref(item) for item in candidates]})

def get_entity(game_slug, model, entity_slug, kind):
    game = game_or_404(game_slug)
    if not game: return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    stmt = db.select(model).where(model.game_id == game.id, model.slug == entity_slug)
    if kind == "hero": stmt = stmt.where(model.status == "active", model.review_status == "approved"); options = (joinedload(model.game), joinedload(model.avatar_media))
    else: stmt = stmt.where(model.review_status == "approved", model.current_status != "retired"); options = (joinedload(model.game), joinedload(model.cover_media))
    item = db.session.scalar(stmt.options(*options))
    return success_response(hero_dict(item) if kind == "hero" else map_dict(item)) if item else error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)

def write_entity(model, kind, entity=None, game=None):
    user = require_admin()
    if not user: return error_response("PERMISSION_DENIED", "无权维护游戏目录。", 403)
    updates, error = catalog_payload(request.get_json(silent=True), kind, entity is None)
    if error: return error
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
