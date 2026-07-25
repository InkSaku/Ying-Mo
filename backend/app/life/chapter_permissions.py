from app.models import UserRole, UserStatus


ADMIN_ROLES = {
    UserRole.CONTENT_ADMIN.value,
    UserRole.SYSTEM_ADMIN.value,
}


def _usable_user(user):
    return bool(user and user.status == UserStatus.ACTIVE.value)


def can_manage_chapter(user, chapter):
    return bool(
        _usable_user(user)
        and chapter
        and (
            chapter.creator_id == user.id
            or user.role in ADMIN_ROLES
        )
    )


def can_edit_chapter(user, chapter):
    return bool(can_manage_chapter(user, chapter) and chapter.status != "merged")


def can_delete_chapter(user, chapter):
    return bool(can_manage_chapter(user, chapter) and chapter.status != "merged")


def can_post_to_chapter(user, chapter):
    if not _usable_user(user) or not user.can_publish or not chapter:
        return False
    if chapter.status != "active" or chapter.review_status != "approved":
        return False
    return bool(
        chapter.contribution_policy == "public"
        or (
            chapter.contribution_policy == "private"
            and chapter.creator_id == user.id
        )
    )
