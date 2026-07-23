from datetime import date
from urllib.parse import urlparse

from app.extensions import db
from app.models import Game, GameHero, GameMap, Media, MediaPurpose, UserStatus
from app.uploads.storage import file_exists, remove_media_files

# Service helpers keep understanding legacy scopes so historical records and
# regression checks can be inspected. Route payload validation only permits
# hero_map for newly created or edited public points.
SCOPES = {"game", "hero", "map", "hero_map"}
CATEGORIES = {"deployment_position", "skill_throw", "timed_throw", "hold_position", "movement_route", "map_interaction", "other"}
CONTENT_MODES = {"simple", "steps"}
SIDES = {"attack", "defense", "both"}; VALIDITIES = {"unverified", "valid", "possibly_invalid", "invalid"}
def field_error(field, code, message): return {"field": field, "code": code, "message": message}
def text(value, maximum, required=False):
    if value is None and not required: return None
    if not isinstance(value, str): raise ValueError("type")
    value = value.strip()
    if (required and not value) or len(value) > maximum: raise ValueError("length")
    return value or None
def clean_tags(value):
    if value is None: return []
    if not isinstance(value, list) or len(value) > 10: raise ValueError("tags")
    result, seen = [], set()
    for item in value:
        item = text(item, 30, True)
        if item.casefold() not in seen: result.append(item); seen.add(item.casefold())
    return result
def clean_video(value):
    value = text(value, 1000)
    if not value: return None
    if urlparse(value).scheme not in {"http", "https"}: raise ValueError("video")
    return value
def clean_date(value): return None if value in (None, "") else date.fromisoformat(value) if isinstance(value, str) else (_ for _ in ()).throw(ValueError("date"))
def searchable(values): return " ".join(str(value) for value in values if value).lower()
def can_publish(user): return bool(user and user.status == UserStatus.ACTIVE.value and user.can_publish)
def validate_scope(data, existing=None, creating=False):
    scope, game_id = data.get("guide_scope", existing.guide_scope if existing else None), data.get("game_id", existing.game_id if existing else None)
    hero_id, map_id = data.get("hero_id", existing.hero_id if existing else None), data.get("map_id", existing.map_id if existing else None)
    if scope not in SCOPES or not isinstance(game_id, int) or game_id <= 0: raise ValueError("scope")
    need_hero, need_map = {"game": (False, False), "hero": (True, False), "map": (False, True), "hero_map": (True, True)}[scope]
    if bool(hero_id) != need_hero or bool(map_id) != need_map: raise ValueError("scope")
    game = db.session.get(Game, game_id); hero = db.session.get(GameHero, hero_id) if hero_id else None; game_map = db.session.get(GameMap, map_id) if map_id else None
    scope_changed = creating or any(field in data for field in ("game_id", "hero_id", "map_id", "guide_scope"))
    if not game or (scope_changed and game.status != "active"): raise LookupError("game")
    if hero and (hero.game_id != game.id or (scope_changed and (hero.status != "active" or hero.review_status != "approved"))): raise LookupError("hero")
    if game_map and (game_map.game_id != game.id or (scope_changed and (game_map.review_status != "approved" or game_map.current_status == "retired"))): raise LookupError("map")
    return game, hero, game_map
def validate_steps(user, steps, content_mode="simple", existing_steps=(), draft_media_ids=()):
    if not isinstance(steps, list) or len(steps) > 20: raise ValueError("steps")
    existing, ids, result = {step.media_id for step in existing_steps}, set(), []
    for item in steps:
        if not isinstance(item, dict) or not isinstance(item.get("media_id"), int) or item["media_id"] <= 0 or item["media_id"] in ids: raise ValueError("steps")
        ids.add(item["media_id"]); media = db.session.get(Media, item["media_id"])
        if not media: raise LookupError("media")
        if media.owner_id != user.id or media.purpose != MediaPurpose.CONTENT or not file_exists(media.storage_key) or not file_exists(media.thumbnail_key) or (media.id not in existing and media.id not in draft_media_ids and media.is_bound): raise PermissionError("media")
        result.append((media, text(item.get("title"), 120, content_mode == "steps"), text(item.get("description"), 3000, content_mode == "steps")))
    return result
def remove_files(items):
    for item in items:
        try: remove_media_files(item)
        except Exception: pass
