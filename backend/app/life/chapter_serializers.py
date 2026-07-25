from app.models.user import serialize_datetime
from app.users.service import public_user_dict

from .chapter_permissions import (
    can_delete_chapter,
    can_edit_chapter,
    can_post_to_chapter,
)


def _chapter_ref(chapter):
    if not chapter:
        return None
    return {
        "id": chapter.id,
        "name": chapter.name,
        "slug": chapter.slug,
    }


def chapter_dict(chapter, user=None, include_children=False, stats=None):
    stats = stats or {}
    counts = stats.get(chapter.id, {})
    cover = chapter.cover_media
    is_owner = bool(user and chapter.creator_id == user.id)
    data = {
        "id": chapter.id,
        "name": chapter.name,
        "slug": chapter.slug,
        "chapter_type": chapter.chapter_type,
        "description": chapter.description,
        "country": chapter.country,
        "province": chapter.province,
        "city": chapter.city,
        "contribution_policy": chapter.contribution_policy,
        "cover_url": (
            f"/api/v1/uploads/images/{cover.public_id}" if cover else None
        ),
        "cover_thumbnail_url": (
            f"/api/v1/uploads/images/{cover.public_id}/thumbnail"
            if cover
            else None
        ),
        "parent": _chapter_ref(chapter.parent),
        "content_count": counts.get("content_count", 0),
        "contributor_count": counts.get("contributor_count", 0),
        "creator": public_user_dict(chapter.creator),
        "is_owner": is_owner,
        "can_post": can_post_to_chapter(user, chapter),
        "can_edit": can_edit_chapter(user, chapter),
        "can_delete": can_delete_chapter(user, chapter),
        "created_at": serialize_datetime(chapter.created_at),
        "updated_at": serialize_datetime(chapter.updated_at),
    }
    if include_children:
        data["children"] = [
            chapter_dict(child, user, stats=stats)
            for child in chapter.children
            if child.status == "active" and child.review_status == "approved"
        ]
    return data


def managed_chapter_dict(chapter, user=None, stats=None, child_count=None):
    data = chapter_dict(chapter, user, stats=stats)
    data.update(
        {
            "status": chapter.status,
            "review_status": chapter.review_status,
            "review_note": chapter.review_note,
            "aliases": chapter.aliases or [],
            "cover_media_id": chapter.cover_media_id,
            "reviewed_by": (
                public_user_dict(chapter.reviewed_by)
                if chapter.reviewed_by
                else None
            ),
            "reviewed_at": serialize_datetime(chapter.reviewed_at),
            "merged_into_id": chapter.merged_into_id,
            "merged_into": _chapter_ref(chapter.merged_into),
        }
    )
    if child_count is not None:
        data["child_count"] = child_count
    return data
