from dataclasses import dataclass

from flask import current_app
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload, selectinload

from app.auth.service import utcnow
from app.extensions import db
from app.interactions.targets import cleanup_target_interactions
from app.models import (
    FeaturedContent,
    LifeChapter,
    LifePost,
    LifePostMedia,
    Media,
    MediaPurpose,
    MediaType,
    Notification,
    Report,
    UserRole,
)
from app.uploads.storage import file_exists, remove_media_files

from .chapter_permissions import can_delete_chapter, can_edit_chapter


CHAPTER_TYPES = {"city", "scenic", "travel", "campus", "event", "custom"}
CONTRIBUTION_POLICIES = {"public", "private"}
OWNER_FIELDS = {
    "name",
    "chapter_type",
    "parent_id",
    "country",
    "province",
    "city",
    "description",
    "contribution_policy",
    "cover_media_id",
}
ADMIN_FIELDS = OWNER_FIELDS | {"aliases", "review_note"}


@dataclass
class ChapterOperationError(Exception):
    code: str
    message: str
    status: int
    details: list | None = None


def _field_error(field, code, message, **extra):
    return {"field": field, "code": code, "message": message, **extra}


def _validation(field, code, message):
    raise ChapterOperationError(
        "VALIDATION_ERROR",
        "请求参数不合法。",
        422,
        [_field_error(field, code, message)],
    )


def _clean_optional_text(value, maximum, field):
    if value is None:
        return None
    if not isinstance(value, str) or len(value.strip()) > maximum:
        _validation(field, "invalid_length", f"{field} 长度不合法。")
    return value.strip() or None


def normalize_aliases(value, name, normalize_name):
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > 20:
        _validation("aliases", "invalid_format", "别名必须是最多 20 项的数组。")
    known = {normalize_name(name)}
    result = []
    for raw in value:
        cleaned = raw.strip() if isinstance(raw, str) else ""
        if not cleaned or len(cleaned) > 80:
            _validation("aliases", "invalid_item", "每个别名长度需为 1 至 80。")
        token = normalize_name(cleaned)
        if token and token not in known:
            result.append(cleaned)
            known.add(token)
    return result


def validate_chapter_payload(payload, chapter, actor, normalize_name):
    if not isinstance(payload, dict):
        _validation("body", "invalid_format", "请求体必须是 JSON 对象。")
    if not payload:
        _validation("body", "required", "至少提交一个可修改字段。")
    is_admin = actor.role in {
        UserRole.CONTENT_ADMIN.value,
        UserRole.SYSTEM_ADMIN.value,
    }
    allowed = ADMIN_FIELDS if is_admin else OWNER_FIELDS
    unknown = set(payload) - allowed
    if unknown:
        field = sorted(unknown)[0]
        _validation(field, "unknown_field", "不支持该字段。")

    updates = {}
    if "name" in payload:
        value = payload["name"]
        if not isinstance(value, str) or not 1 <= len(value.strip()) <= 80:
            _validation("name", "invalid_length", "章节名称长度需为 1 至 80。")
        updates["name"] = value.strip()
    if "chapter_type" in payload:
        if payload["chapter_type"] not in CHAPTER_TYPES:
            _validation("chapter_type", "invalid_choice", "章节类型不合法。")
        updates["chapter_type"] = payload["chapter_type"]
    if "parent_id" in payload:
        value = payload["parent_id"]
        if value is not None and (
            not isinstance(value, int) or isinstance(value, bool) or value <= 0
        ):
            _validation("parent_id", "invalid_type", "parent_id 必须是正整数或 null。")
        updates["parent_id"] = value
    for field, maximum in (
        ("country", 100),
        ("province", 100),
        ("city", 100),
        ("description", 500),
        ("review_note", 1000),
    ):
        if field in payload:
            updates[field] = _clean_optional_text(payload[field], maximum, field)
    if "contribution_policy" in payload:
        if payload["contribution_policy"] not in CONTRIBUTION_POLICIES:
            _validation(
                "contribution_policy",
                "invalid_choice",
                "投稿权限只能是 public 或 private。",
            )
        updates["contribution_policy"] = payload["contribution_policy"]
    if "cover_media_id" in payload:
        value = payload["cover_media_id"]
        if value is not None and (
            not isinstance(value, int) or isinstance(value, bool) or value <= 0
        ):
            _validation(
                "cover_media_id",
                "invalid_type",
                "cover_media_id 必须是正整数或 null。",
            )
        updates["cover_media_id"] = value
    if "aliases" in payload:
        updates["aliases"] = normalize_aliases(
            payload["aliases"],
            updates.get("name", chapter.name),
            normalize_name,
        )
    return updates


def validate_chapter_parent(chapter, parent_id, *, lock=False):
    if parent_id is None:
        return None
    stmt = db.select(LifeChapter).where(LifeChapter.id == parent_id)
    if lock:
        stmt = stmt.with_for_update()
    parent = db.session.scalar(stmt)
    if (
        not parent
        or parent.id == chapter.id
        or parent.status != "active"
        or parent.review_status != "approved"
        or parent.parent_id is not None
    ):
        raise ChapterOperationError(
            "VALIDATION_ERROR",
            "父章节不可用，或会造成循环/第三层。",
            422,
            [_field_error("parent_id", "invalid_parent", "父章节必须是可用的一级章节。")],
        )
    if chapter.children and chapter.parent_id != parent.id:
        raise ChapterOperationError(
            "VALIDATION_ERROR",
            "有子章节的一级章节不能直接改为二级章节。",
            422,
            [_field_error("parent_id", "children_exist", "请先处理现有子章节。")],
        )
    current = parent
    while current:
        if current.id == chapter.id:
            raise ChapterOperationError(
                "VALIDATION_ERROR",
                "父章节设置会形成循环。",
                422,
                [_field_error("parent_id", "cycle", "不能选择自己的后代章节。")],
            )
        current = current.parent
    return parent


def resolve_chapter_cover(actor, media_id, old_cover_id=None):
    if media_id is None:
        return None
    media = db.session.scalar(
        db.select(Media).where(Media.id == media_id).with_for_update()
    )
    if not media:
        raise ChapterOperationError(
            "RESOURCE_NOT_FOUND", "请求的图片不存在。", 404
        )
    if media.id == old_cover_id:
        return media
    if media.owner_id != actor.id:
        raise ChapterOperationError(
            "PERMISSION_DENIED", "无权使用该图片。", 403
        )
    if media.purpose != MediaPurpose.CONTENT or media.media_type != MediaType.IMAGE or media.is_bound:
        raise ChapterOperationError(
            "RESOURCE_CONFLICT", "图片不可作为章节封面。", 409
        )
    if not file_exists(media.storage_key) or not file_exists(media.thumbnail_key):
        raise ChapterOperationError(
            "RESOURCE_CONFLICT", "图片文件不完整，无法作为章节封面。", 409
        )
    return media


def update_chapter(chapter_id, actor, payload, normalize_name):
    chapter = db.session.scalar(
        db.select(LifeChapter)
        .where(LifeChapter.id == chapter_id)
        .options(
            joinedload(LifeChapter.cover_media),
            selectinload(LifeChapter.children),
        )
        .execution_options(populate_existing=True)
        .with_for_update()
    )
    if not chapter:
        raise ChapterOperationError(
            "RESOURCE_NOT_FOUND", "请求的资源不存在。", 404
        )
    if chapter.status == "merged":
        raise ChapterOperationError(
            "RESOURCE_CONFLICT", "已合并章节不能普通编辑。", 409
        )
    if not can_edit_chapter(actor, chapter):
        raise ChapterOperationError("PERMISSION_DENIED", "无权编辑该章节。", 403)

    updates = validate_chapter_payload(payload, chapter, actor, normalize_name)
    before = {
        field: getattr(chapter, field)
        for field in updates
        if field != "cover_media_id"
    }
    if "cover_media_id" in updates:
        before["cover_media_id"] = chapter.cover_media_id
    parent_id = updates.get("parent_id", chapter.parent_id)
    if "parent_id" in updates and parent_id != chapter.parent_id:
        validate_chapter_parent(chapter, parent_id, lock=True)
    name = updates.get("name", chapter.name)
    normalized = normalize_name(name)
    dedupe_key = (
        f"root:{normalized}" if parent_id is None else f"{parent_id}:{normalized}"
    )
    conflict = db.session.scalar(
        db.select(LifeChapter.id)
        .where(
            LifeChapter.dedupe_key == dedupe_key,
            LifeChapter.id != chapter.id,
        )
        .with_for_update()
    )
    if conflict:
        raise ChapterOperationError(
            "DUPLICATE_RESOURCE", "同层级已存在同名章节。", 409
        )

    cover_was_supplied = "cover_media_id" in updates
    requested_cover_id = updates.pop("cover_media_id", None)
    old_cover = chapter.cover_media
    new_cover = (
        resolve_chapter_cover(actor, requested_cover_id, chapter.cover_media_id)
        if cover_was_supplied
        else old_cover
    )
    old_files = []

    for field, value in updates.items():
        setattr(chapter, field, value)
    chapter.normalized_name = normalized
    chapter.dedupe_key = dedupe_key
    chapter.updated_at = utcnow()

    is_admin = actor.role in {
        UserRole.CONTENT_ADMIN.value,
        UserRole.SYSTEM_ADMIN.value,
    }
    if not is_admin and chapter.review_status in {"pending", "rejected"}:
        chapter.review_status = "pending"
        chapter.review_note = None
        chapter.reviewed_by_id = None
        chapter.reviewed_at = None

    if cover_was_supplied and requested_cover_id != chapter.cover_media_id:
        chapter.cover_media_id = None
        db.session.flush()
        if old_cover:
            old_files.append(old_cover)
            db.session.delete(old_cover)
            db.session.flush()
        if new_cover:
            new_cover.bound_type = "life_chapter_cover"
            new_cover.bound_id = chapter.id
            new_cover.bound_at = utcnow()
            chapter.cover_media_id = new_cover.id

    if is_admin:
        from app.admin.audit import create_admin_log

        after = {
            field: getattr(chapter, field)
            for field in before
        }
        create_admin_log(
            actor,
            "chapter_updated",
            "life_chapter",
            chapter.id,
            chapter.name,
            before,
            after,
        )

    try:
        db.session.commit()
    except IntegrityError as error:
        db.session.rollback()
        raise ChapterOperationError(
            "DUPLICATE_RESOURCE", "同层级已存在同名章节。", 409
        ) from error
    except Exception:
        db.session.rollback()
        raise
    _remove_files_after_commit(old_files)
    return chapter


def _counts(chapter_id):
    post_count = (
        db.session.scalar(
            db.select(func.count(LifePost.id)).where(
                LifePost.chapter_id == chapter_id
            )
        )
        or 0
    )
    child_count = (
        db.session.scalar(
            db.select(func.count(LifeChapter.id)).where(
                LifeChapter.parent_id == chapter_id,
                LifeChapter.status != "merged",
            )
        )
        or 0
    )
    return post_count, child_count


def _promotion_conflicts(source, children, *, lock=False):
    normalized_names = [child.normalized_name for child in children]
    if not normalized_names:
        return []
    stmt = db.select(LifeChapter).where(
            LifeChapter.parent_id.is_(None),
            LifeChapter.id != source.id,
            LifeChapter.normalized_name.in_(normalized_names),
            LifeChapter.status != "merged",
        )
    if lock:
        stmt = stmt.order_by(LifeChapter.id).with_for_update()
    rows = db.session.scalars(stmt).all()
    by_name = {item.normalized_name: item for item in rows}
    return [
        {
            "chapter_id": child.id,
            "chapter_name": child.name,
            "conflicting_chapter_id": by_name[child.normalized_name].id,
            "conflicting_chapter_name": by_name[child.normalized_name].name,
        }
        for child in children
        if child.normalized_name in by_name
    ]


def _target_is_eligible(source, target, children):
    if (
        not target
        or target.id == source.id
        or target.status != "active"
        or target.review_status != "approved"
    ):
        return False
    if target.contribution_policy == "private" and (
        target.creator_id != source.creator_id
    ):
        return False
    if any(child.id == target.id for child in children):
        return False
    if children and target.parent_id is not None:
        return False
    current = target
    while current:
        if current.id == source.id:
            return False
        current = current.parent
    return True


def preview_chapter_deletion(chapter_id, actor):
    chapter = db.session.scalar(
        db.select(LifeChapter)
        .where(LifeChapter.id == chapter_id)
        .options(selectinload(LifeChapter.children))
    )
    if not chapter:
        raise ChapterOperationError(
            "RESOURCE_NOT_FOUND", "请求的资源不存在。", 404
        )
    if not can_delete_chapter(actor, chapter):
        if chapter.status == "merged":
            raise ChapterOperationError(
                "RESOURCE_CONFLICT", "已合并章节不能再次普通删除。", 409
            )
        raise ChapterOperationError("PERMISSION_DENIED", "无权删除该章节。", 403)
    all_children = list(chapter.children)
    children = [child for child in all_children if child.status != "merged"]
    post_count, child_count = _counts(chapter.id)
    other_author_post_count = (
        db.session.scalar(
            db.select(func.count(LifePost.id)).where(
                LifePost.chapter_id == chapter.id,
                LifePost.author_id != chapter.creator_id,
            )
        )
        or 0
    )
    force_chapter_ids = [chapter.id, *(child.id for child in all_children)]
    force_delete_post_count = (
        db.session.scalar(
            db.select(func.count(LifePost.id)).where(
                LifePost.chapter_id.in_(force_chapter_ids)
            )
        )
        or 0
    )
    force_delete_image_count = (
        db.session.scalar(
            db.select(func.count(LifePostMedia.id))
            .join(LifePost, LifePost.id == LifePostMedia.post_id)
            .where(LifePost.chapter_id.in_(force_chapter_ids))
        )
        or 0
    ) + sum(bool(item.cover_media_id) for item in [chapter, *all_children])
    targets = db.session.scalars(
        db.select(LifeChapter)
        .where(
            LifeChapter.id != chapter.id,
            LifeChapter.status == "active",
            LifeChapter.review_status == "approved",
        )
        .order_by(LifeChapter.name, LifeChapter.id)
    ).all()
    eligible = [
        {
            "id": target.id,
            "name": target.name,
            "slug": target.slug,
            "contribution_policy": target.contribution_policy,
        }
        for target in targets
        if _target_is_eligible(chapter, target, children)
    ]
    return {
        "chapter_id": chapter.id,
        "chapter_name": chapter.name,
        "post_count": post_count,
        "other_author_post_count": other_author_post_count,
        "child_count": child_count,
        "has_cover": bool(chapter.cover_media_id),
        "force_delete_post_count": force_delete_post_count,
        "force_delete_child_count": len(all_children),
        "force_delete_image_count": force_delete_image_count,
        "can_hard_delete": post_count == 0 and child_count == 0,
        "requires_target": post_count > 0,
        "child_name_conflicts": (
            _promotion_conflicts(chapter, children) if post_count == 0 else []
        ),
        "eligible_targets": eligible,
    }


def _remove_files_after_commit(media_items):
    for media in media_items:
        try:
            remove_media_files(media)
        except Exception:
            current_app.logger.exception(
                "Unable to remove committed chapter media %s", media.id
            )


def _admin_log(actor, action, chapter, before, after, metadata):
    if actor.role not in {
        UserRole.CONTENT_ADMIN.value,
        UserRole.SYSTEM_ADMIN.value,
    }:
        return
    from app.admin.audit import create_admin_log

    create_admin_log(
        actor,
        action,
        "life_chapter",
        chapter.id,
        chapter.name,
        before,
        after,
        metadata,
    )


def delete_or_merge_chapter(
    chapter_id,
    actor,
    *,
    confirmation_name,
    target_chapter_id=None,
    reason=None,
    merge_even_if_empty=False,
    require_confirmation=True,
    audit_action="chapter_deleted_as_merge",
):
    lock_ids = {chapter_id}
    if (
        isinstance(target_chapter_id, int)
        and not isinstance(target_chapter_id, bool)
        and target_chapter_id > 0
    ):
        lock_ids.add(target_chapter_id)
    locked_chapters = db.session.scalars(
        db.select(LifeChapter)
        .where(LifeChapter.id.in_(sorted(lock_ids)))
        .order_by(LifeChapter.id)
        .execution_options(populate_existing=True)
        .with_for_update()
    ).all()
    source = next(
        (item for item in locked_chapters if item.id == chapter_id),
        None,
    )
    if not source:
        raise ChapterOperationError(
            "RESOURCE_NOT_FOUND", "请求的资源不存在。", 404
        )
    if source.status == "merged":
        raise ChapterOperationError(
            "RESOURCE_CONFLICT", "已合并章节不能再次普通删除。", 409
        )
    if not can_delete_chapter(actor, source):
        raise ChapterOperationError("PERMISSION_DENIED", "无权删除该章节。", 403)
    if require_confirmation and confirmation_name != source.name:
        _validation(
            "confirmation_name",
            "confirmation_mismatch",
            "确认名称必须与当前章节完整名称一致。",
        )
    is_admin_other = (
        actor.id != source.creator_id
        and actor.role
        in {UserRole.CONTENT_ADMIN.value, UserRole.SYSTEM_ADMIN.value}
    )
    if is_admin_other and (
        not isinstance(reason, str) or not reason.strip() or len(reason.strip()) > 1000
    ):
        _validation("reason", "required", "管理员删除他人章节必须填写原因。")

    children = db.session.scalars(
        db.select(LifeChapter)
        .where(
            LifeChapter.parent_id == source.id,
            LifeChapter.status != "merged",
        )
        .order_by(LifeChapter.id)
        .with_for_update()
    ).all()
    posts = db.session.scalars(
        db.select(LifePost)
        .where(LifePost.chapter_id == source.id)
        .order_by(LifePost.id)
        .with_for_update()
    ).all()
    post_count, child_count = len(posts), len(children)
    old_cover = source.cover_media
    media_to_remove = [old_cover] if old_cover else []
    before = {
        "status": source.status,
        "post_count": post_count,
        "child_count": child_count,
        "cover_media_id": source.cover_media_id,
    }

    if not posts and not merge_even_if_empty:
        conflicts = _promotion_conflicts(source, children, lock=True)
        if conflicts:
            raise ChapterOperationError(
                "RESOURCE_CONFLICT",
                "子章节提升后会与现有一级章节重名。",
                409,
                conflicts,
            )
        for child in children:
            child.parent_id = None
            child.dedupe_key = f"root:{child.normalized_name}"
        source.cover_media_id = None
        db.session.flush()
        if old_cover:
            db.session.delete(old_cover)
        _admin_log(
            actor,
            "chapter_deleted",
            source,
            before,
            {"status": "deleted"},
            {
                "reason": reason.strip() if isinstance(reason, str) else None,
                "post_count": 0,
                "child_count": child_count,
                "mode": "hard_delete",
            },
        )
        db.session.delete(source)
        try:
            db.session.commit()
        except IntegrityError as error:
            db.session.rollback()
            raise ChapterOperationError(
                "RESOURCE_CONFLICT",
                "章节层级或同层名称发生并发冲突，请重新预检。",
                409,
            ) from error
        except Exception:
            db.session.rollback()
            raise
        _remove_files_after_commit(media_to_remove)
        return {
            "mode": "hard_deleted",
            "source_id": chapter_id,
            "promoted_child_count": child_count,
        }

    if not isinstance(target_chapter_id, int) or isinstance(
        target_chapter_id, bool
    ) or target_chapter_id <= 0:
        raise ChapterOperationError(
            "RESOURCE_CONFLICT",
            "该章节有关联日常，必须选择迁移目标。",
            409,
            [
                _field_error(
                    "target_chapter_id",
                    "required",
                    "请选择合法的目标章节。",
                )
            ],
        )
    target = next(
        (
            item
            for item in locked_chapters
            if item.id == target_chapter_id
        ),
        None,
    )
    if not target:
        raise ChapterOperationError(
            "RESOURCE_NOT_FOUND", "目标章节不存在。", 404
        )
    if not _target_is_eligible(source, target, children):
        raise ChapterOperationError(
            "RESOURCE_CONFLICT",
            "目标章节不可用、层级不合法，或私有章节所有权不匹配。",
            409,
            [
                _field_error(
                    "target_chapter_id",
                    "invalid_target",
                    "请选择预检列出的合法目标章节。",
                )
            ],
        )

    aliases = list(target.aliases or [])
    normalized_aliases = {target.name.casefold(), *(item.casefold() for item in aliases)}
    for alias in [source.name, *(source.aliases or [])]:
        token = alias.casefold()
        if token not in normalized_aliases and len(aliases) < 20:
            aliases.append(alias)
            normalized_aliases.add(token)
    target.aliases = aliases

    target_children = db.session.scalars(
        db.select(LifeChapter)
        .where(LifeChapter.parent_id == target.id)
        .order_by(LifeChapter.id)
        .with_for_update()
    ).all()
    target_children_by_name = {
        child.normalized_name: child
        for child in target_children
        if child.status != "merged"
    }
    affected_authors = {
        post.author_id for post in posts if post.author_id != actor.id
    }
    for post in posts:
        post.chapter_id = target.id
    for child in children:
        duplicate = target_children_by_name.get(child.normalized_name)
        if duplicate:
            child_posts = db.session.scalars(
                db.select(LifePost)
                .where(LifePost.chapter_id == child.id)
                .order_by(LifePost.id)
                .with_for_update()
            ).all()
            for post in child_posts:
                if post.author_id != actor.id:
                    affected_authors.add(post.author_id)
                post.chapter_id = duplicate.id
            obsolete_cover = child.cover_media
            if obsolete_cover:
                child.cover_media_id = None
                db.session.flush()
                db.session.delete(obsolete_cover)
                media_to_remove.append(obsolete_cover)
            child.status = "merged"
            child.merged_into_id = duplicate.id
        else:
            child.parent_id = target.id
            child.dedupe_key = f"{target.id}:{child.normalized_name}"
    source.status = "merged"
    source.merged_into_id = target.id
    source.cover_media_id = None
    if old_cover:
        db.session.flush()
        db.session.delete(old_cover)
    for author_id in affected_authors:
        db.session.add(
            Notification(
                recipient_id=author_id,
                actor_id=actor.id,
                notification_type="system",
                payload={
                    "message": f"你在「{source.name}」中的日常已迁移到「{target.name}」。",
                    "source_chapter_id": source.id,
                    "target_chapter_id": target.id,
                    "target_slug": target.slug,
                },
                dedupe_key=(
                    f"chapter-migration:{source.id}:{target.id}:{author_id}"
                ),
            )
        )
    _admin_log(
        actor,
        audit_action,
        source,
        before,
        {"status": "merged", "merged_into_id": target.id},
        {
            "reason": reason.strip() if isinstance(reason, str) else None,
            "target_chapter_id": target.id,
            "post_count": post_count,
            "child_count": child_count,
            "mode": "merged",
        },
    )
    try:
        db.session.commit()
    except IntegrityError as error:
        db.session.rollback()
        raise ChapterOperationError(
            "RESOURCE_CONFLICT",
            "章节迁移发生并发冲突，请重新预检。",
            409,
        ) from error
    except Exception:
        db.session.rollback()
        raise
    _remove_files_after_commit(media_to_remove)
    return {
        "mode": "merged",
        "source_id": source.id,
        "target_chapter_id": target.id,
        "canonical_slug": target.slug,
    }


def _delete_post_for_force(post):
    media = [link.media for link in post.media_links]
    cleanup_target_interactions("life_post", post.id)
    report_ids = list(
        db.session.scalars(
            db.select(Report.id).where(
                Report.target_type == "life_post",
                Report.target_id == post.id,
            )
        )
    )
    if report_ids:
        db.session.execute(
            db.delete(Notification).where(
                Notification.notification_type == "report_result",
                Notification.payload["report_id"].as_integer().in_(report_ids),
            )
        )
    db.session.execute(
        db.delete(FeaturedContent).where(
            FeaturedContent.target_type == "life_post",
            FeaturedContent.target_id == post.id,
        )
    )
    db.session.execute(
        db.delete(Report).where(
            Report.target_type == "life_post",
            Report.target_id == post.id,
        )
    )
    db.session.delete(post)
    db.session.flush()
    for item in media:
        db.session.delete(item)
    return media


def force_delete_chapter(
    chapter_id,
    actor,
    *,
    reason,
    confirmation,
    cascade_posts,
    cascade_children,
):
    if actor.role != UserRole.SYSTEM_ADMIN.value:
        raise ChapterOperationError(
            "PERMISSION_DENIED", "需要系统管理员权限。", 403
        )
    if not isinstance(reason, str) or not reason.strip() or len(reason.strip()) > 1000:
        _validation("reason", "required", "强制删除必须填写详细原因。")
    expected = f"DELETE CHAPTER {chapter_id}"
    if confirmation != expected:
        _validation(
            "confirmation",
            "confirmation_mismatch",
            f"确认词必须严格等于 {expected}。",
        )
    if cascade_posts is not True or cascade_children is not True:
        _validation(
            "cascade_posts",
            "required",
            "必须明确确认级联清理日常和子章节。",
        )

    source = db.session.scalar(
        db.select(LifeChapter)
        .where(LifeChapter.id == chapter_id)
        .options(joinedload(LifeChapter.cover_media))
        .execution_options(populate_existing=True)
        .with_for_update()
    )
    if not source:
        raise ChapterOperationError(
            "RESOURCE_NOT_FOUND", "请求的资源不存在。", 404
        )
    children = db.session.scalars(
        db.select(LifeChapter)
        .where(LifeChapter.parent_id == source.id)
        .options(joinedload(LifeChapter.cover_media))
        .order_by(LifeChapter.id)
        .with_for_update()
    ).all()
    chapter_ids = [source.id, *(child.id for child in children)]
    posts = db.session.scalars(
        db.select(LifePost)
        .where(LifePost.chapter_id.in_(chapter_ids))
        .options(
            selectinload(LifePost.media_links).joinedload(LifePostMedia.media)
        )
        .order_by(LifePost.id)
        .with_for_update()
    ).unique().all()
    media_to_remove = []
    affected_authors = {
        post.author_id for post in posts if post.author_id != actor.id
    }
    before = {
        "status": source.status,
        "post_count": len(posts),
        "child_count": len(children),
        "image_count": sum(len(post.media_links) for post in posts)
        + sum(bool(item.cover_media_id) for item in [source, *children]),
    }
    for post in posts:
        media_to_remove.extend(_delete_post_for_force(post))
    for author_id in affected_authors:
        db.session.add(
            Notification(
                recipient_id=author_id,
                actor_id=actor.id,
                notification_type="system",
                payload={
                    "message": f"你在「{source.name}」相关章节中的日常已被系统管理员永久删除。",
                    "chapter_id": source.id,
                    "reason": reason.strip(),
                },
                dedupe_key=f"chapter-force-delete:{source.id}:{author_id}",
            )
        )
    for chapter in reversed(children):
        cover = chapter.cover_media
        if cover:
            media_to_remove.append(cover)
            chapter.cover_media_id = None
            db.session.flush()
            db.session.delete(cover)
        db.session.delete(chapter)
    source_cover = source.cover_media
    if source_cover:
        media_to_remove.append(source_cover)
        source.cover_media_id = None
        db.session.flush()
        db.session.delete(source_cover)
    _admin_log(
        actor,
        "chapter_force_deleted",
        source,
        before,
        {"status": "deleted"},
        {
            "reason": reason.strip(),
            "cascade_posts": True,
            "cascade_children": True,
            **before,
        },
    )
    db.session.delete(source)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    _remove_files_after_commit(media_to_remove)
    return {
        "chapter_id": chapter_id,
        "deleted_post_count": len(posts),
        "deleted_child_count": len(children),
        "deleted_image_count": before["image_count"],
    }
