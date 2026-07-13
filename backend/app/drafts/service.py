import json

from app.auth.service import utcnow
from app.extensions import db
from app.models import ContentDraft, ContentDraftMedia, Media, MediaPurpose, UserStatus
from app.models.user import serialize_datetime
from app.uploads.storage import file_exists, remove_media_files


DRAFT_TYPES = {"life_post", "game_guide"}
LIFE_FIELDS = {"title", "body", "chapter_id", "location", "mood", "tags", "shot_at", "visibility"}
GUIDE_FIELDS = {
    "game_id", "hero_id", "map_id", "guide_scope", "title", "category", "instructions",
    "map_area", "side", "skill", "aim_reference", "timing", "difficulty", "game_version",
    "tags", "notes", "video_url", "validity_status", "tested_at", "validity_note", "steps",
}


def can_save_drafts(user):
    return bool(user and user.status == UserStatus.ACTIVE.value and user.can_publish)


def draft_dict(draft, detail=False):
    data = {
        "id": draft.id,
        "draft_type": draft.draft_type,
        "title": draft.title_cache or "未命名草稿",
        "media_count": len(draft.media_links),
        "created_at": serialize_datetime(draft.created_at),
        "updated_at": serialize_datetime(draft.updated_at),
    }
    if detail:
        data.update({
            "payload": draft.payload or {},
            "media_ids": [link.media_id for link in draft.media_links],
            "media": [link.media.to_dict() for link in draft.media_links],
        })
    return data


def _clean_text(value, maximum, nullable=True):
    if value is None and nullable:
        return None
    if not isinstance(value, str):
        raise ValueError("invalid_type")
    value = value.strip()
    if len(value) > maximum:
        raise ValueError("invalid_length")
    return value or None


def validate_payload(draft_type, payload):
    if draft_type not in DRAFT_TYPES or not isinstance(payload, dict):
        raise ValueError("invalid_payload")
    allowed = LIFE_FIELDS if draft_type == "life_post" else GUIDE_FIELDS
    if set(payload) - allowed:
        raise ValueError("unknown_field")
    cleaned = dict(payload)
    if draft_type == "life_post":
        for field, maximum in (("title", 100), ("body", 5000), ("location", 100), ("mood", 30)):
            if field in cleaned:
                cleaned[field] = _clean_text(cleaned[field], maximum)
        if "chapter_id" in cleaned and cleaned["chapter_id"] is not None and (not isinstance(cleaned["chapter_id"], int) or isinstance(cleaned["chapter_id"], bool) or cleaned["chapter_id"] <= 0):
            raise ValueError("chapter_id")
        if "visibility" in cleaned and cleaned["visibility"] not in {"public", "login_only", "private"}:
            raise ValueError("visibility")
        if "tags" in cleaned:
            if not isinstance(cleaned["tags"], list) or len(cleaned["tags"]) > 10:
                raise ValueError("tags")
            tags, seen = [], set()
            for tag in cleaned["tags"]:
                tag = _clean_text(tag, 20, False)
                if not tag:
                    raise ValueError("tags")
                if tag.casefold() not in seen:
                    tags.append(tag)
                    seen.add(tag.casefold())
            cleaned["tags"] = tags
    else:
        for field, maximum in (("title", 120), ("instructions", 10000), ("map_area", 120), ("skill", 120), ("aim_reference", 500), ("timing", 500), ("game_version", 50), ("notes", 5000), ("validity_note", 1000), ("video_url", 1000)):
            if field in cleaned:
                cleaned[field] = _clean_text(cleaned[field], maximum)
        for field in ("game_id", "hero_id", "map_id"):
            if field in cleaned and cleaned[field] is not None and (not isinstance(cleaned[field], int) or isinstance(cleaned[field], bool) or cleaned[field] <= 0):
                raise ValueError(field)
        if "guide_scope" in cleaned and cleaned["guide_scope"] not in {"game", "hero", "map", "hero_map", None, ""}:
            raise ValueError("guide_scope")
        if "category" in cleaned and cleaned["category"] not in {"skill_position", "turret_position", "grenade_throw", "detonator_throw", "hold_angle", "defense_position", "attack_route", "opening_tip", "energy_gain", "team_composition", "map_mechanic", "other", None, ""}:
            raise ValueError("category")
        if "side" in cleaned and cleaned["side"] not in {"attack", "defense", "both", None, ""}:
            raise ValueError("side")
        if "difficulty" in cleaned and cleaned["difficulty"] not in {"beginner", "intermediate", "advanced", None, ""}:
            raise ValueError("difficulty")
        if "validity_status" in cleaned and cleaned["validity_status"] not in {"unverified", "valid", "possibly_invalid", "invalid", None, ""}:
            raise ValueError("validity_status")
        if "steps" in cleaned:
            if not isinstance(cleaned["steps"], list) or len(cleaned["steps"]) > 20:
                raise ValueError("steps")
            clean_steps = []
            for step in cleaned["steps"]:
                if not isinstance(step, dict):
                    raise ValueError("steps")
                result = {key: step[key] for key in ("client_id", "media_id", "title", "description") if key in step}
                if "client_id" in result and (not isinstance(result["client_id"], str) or len(result["client_id"]) > 100):
                    raise ValueError("steps")
                if "media_id" in result and result["media_id"] is not None and (not isinstance(result["media_id"], int) or isinstance(result["media_id"], bool) or result["media_id"] <= 0):
                    raise ValueError("steps")
                for key, maximum in (("title", 120), ("description", 3000)):
                    if key in result:
                        result[key] = _clean_text(result[key], maximum)
                clean_steps.append(result)
            cleaned["steps"] = clean_steps
    if len(json.dumps(cleaned, ensure_ascii=False).encode("utf-8")) > 128 * 1024:
        raise ValueError("too_large")
    return cleaned


def validate_draft_media(user, media_ids, existing_ids=()):
    if not isinstance(media_ids, list) or len(media_ids) != len(set(media_ids)):
        raise ValueError("media")
    if any(not isinstance(item, int) or isinstance(item, bool) or item <= 0 for item in media_ids):
        raise ValueError("media")
    media = db.session.scalars(db.select(Media).where(Media.id.in_(media_ids))).all() if media_ids else []
    lookup = {item.id: item for item in media}
    if len(lookup) != len(media_ids):
        raise LookupError("media")
    for media_id in media_ids:
        item = lookup[media_id]
        if item.owner_id != user.id or item.purpose != MediaPurpose.CONTENT or (item.is_bound and item.id not in existing_ids):
            raise PermissionError("media")
        if not file_exists(item.storage_key) or not file_exists(item.thumbnail_key):
            raise PermissionError("media")
    return [lookup[media_id] for media_id in media_ids]


def cleanup_media(items):
    for item in items:
        try:
            remove_media_files(item)
        except Exception:
            pass


def draft_media_ids(draft):
    return {link.media_id for link in draft.media_links}


def delete_draft(draft):
    media = [link.media for link in draft.media_links]
    db.session.delete(draft)
    db.session.commit()
    cleanup_media(media)


def touch_draft(draft):
    draft.updated_at = utcnow()
