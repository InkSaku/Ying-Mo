import re
import unicodedata
import uuid

from sqlalchemy import or_

from app.extensions import db
from app.models import Game, GameHero, GameMap, Media, MediaPurpose, UserRole, UserStatus
from app.uploads.storage import file_exists


def normalize_name(value):
    if not isinstance(value, str):
        return ""
    value = unicodedata.normalize("NFKC", value).strip()
    value = re.sub(r"\s+", " ", value).casefold()
    return "".join(char for char in value if char.isalnum())


def clean_text(value):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value).strip()) if isinstance(value, str) else None


def slug_for(value):
    readable = re.sub(r"[^a-z0-9]+", "-", normalize_name(value)).strip("-")
    return f"{readable[:120]}-{uuid.uuid4().hex[:8]}" if readable else f"catalog-{uuid.uuid4().hex}"


def clean_aliases(value, name_zh, name_en):
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > 20:
        raise ValueError("aliases")
    known = {normalize_name(name_zh), normalize_name(name_en)} - {""}
    aliases = []
    for item in value:
        cleaned = clean_text(item)
        token = normalize_name(cleaned)
        if not cleaned or not 1 <= len(cleaned) <= 80 or not token:
            if cleaned:
                raise ValueError("aliases")
            continue
        if token not in known:
            aliases.append(cleaned)
            known.add(token)
    return aliases


def name_tokens(name_zh, name_en, aliases):
    return {token for token in [normalize_name(name_zh), normalize_name(name_en), *(normalize_name(item) for item in aliases)] if token}


def search_text(name_zh, name_en, aliases):
    return " ".join(filter(None, [clean_text(name_zh), clean_text(name_en), *aliases]))[:800]


def is_catalog_admin(user):
    return bool(user and user.status == UserStatus.ACTIVE.value and user.role in {UserRole.CONTENT_ADMIN.value, UserRole.SYSTEM_ADMIN.value})


def entity_has_conflict(model, tokens, game_id=None, exclude_id=None):
    stmt = db.select(model)
    if game_id is not None:
        stmt = stmt.where(model.game_id == game_id)
    if exclude_id is not None:
        stmt = stmt.where(model.id != exclude_id)
    patterns = [model.search_text.ilike(f"%{token.replace('%', '\\%').replace('_', '\\_')}%", escape="\\") for token in tokens]
    if patterns:
        stmt = stmt.where(or_(*patterns))
    for entity in db.session.scalars(stmt.limit(20)).all():
        if tokens & name_tokens(entity.name_zh, entity.name_en, entity.aliases or []):
            return entity
    return None


def validate_media(user, media_id, allowed_bound_types=()):
    if media_id is None:
        return None
    if not isinstance(media_id, int) or isinstance(media_id, bool) or media_id <= 0:
        raise ValueError("media")
    media = db.session.get(Media, media_id)
    if not media:
        raise LookupError("media")
    if media.owner_id != user.id or media.purpose != MediaPurpose.CONTENT or (media.is_bound and media.bound_type not in allowed_bound_types):
        raise PermissionError("media")
    if not file_exists(media.storage_key) or not file_exists(media.thumbnail_key):
        raise PermissionError("media")
    return media


def media_url(media, thumbnail=False):
    if not media:
        return None
    suffix = "/thumbnail" if thumbnail else ""
    return f"/api/v1/uploads/images/{media.public_id}{suffix}"


def public_media_allowed(media, user):
    if not media:
        return False
    if user and (media.owner_id == user.id or is_catalog_admin(user)):
        return True
    if media.bound_type in {"game_icon", "game_cover"}:
        game = db.session.get(Game, media.bound_id)
        return bool(game and game.status == "active")
    if media.bound_type == "game_hero_avatar":
        hero = db.session.get(GameHero, media.bound_id)
        return bool(hero and hero.game.status == "active" and hero.status == "active" and hero.review_status == "approved")
    if media.bound_type == "game_map_cover":
        game_map = db.session.get(GameMap, media.bound_id)
        return bool(game_map and game_map.game.status == "active" and game_map.review_status == "approved" and game_map.current_status != "retired")
    return False
