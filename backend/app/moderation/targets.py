from app.extensions import db
from app.models import Comment, GameGuide, LifePost, User, UserStatus
from app.life.routes import can_view_post


REPORT_TARGET_TYPES = {"life_post", "game_guide", "comment", "user"}
CONTENT_TARGET_TYPES = {"life_post", "game_guide"}


def resolve_report_target(target_type, target_id, viewer):
    if target_type not in REPORT_TARGET_TYPES or not isinstance(target_id, int) or isinstance(target_id, bool) or target_id <= 0:
        return None
    if target_type == "life_post":
        target = db.session.get(LifePost, target_id)
        return target if target and target.status == "published" and target.visibility != "private" and can_view_post(target, viewer) else None
    if target_type == "game_guide":
        target = db.session.get(GameGuide, target_id)
        return target if target and target.status == "published" else None
    if target_type == "user":
        target = db.session.get(User, target_id)
        return target if target and target.status == UserStatus.ACTIVE.value else None
    target = db.session.get(Comment, target_id)
    if not target or target.status != "active":
        return None
    return target if resolve_report_target(target.target_type, target.target_id, viewer) else None


def resolve_admin_target(target_type, target_id, admin):
    if target_type not in REPORT_TARGET_TYPES or not isinstance(target_id, int) or target_id <= 0:
        return None
    model = {"life_post": LifePost, "game_guide": GameGuide, "comment": Comment, "user": User}[target_type]
    return db.session.get(model, target_id)


def target_public_url(target_type, target):
    if target_type == "life_post": return f"/life/post/{target.id}"
    if target_type == "game_guide": return f"/guide/{target.id}"
    if target_type == "user": return f"/user/{target.username}"
    return f"/life/post/{target.target_id}" if target.target_type == "life_post" else f"/guide/{target.target_id}"


def serialize_target_snapshot(target_type, target):
    if target_type == "life_post": return {"id": target.id, "title": target.title[:100], "author_id": target.author_id, "visibility": target.visibility, "url": target_public_url(target_type, target)}
    if target_type == "game_guide": return {"id": target.id, "title": target.title[:120], "author_id": target.author_id, "url": target_public_url(target_type, target)}
    if target_type == "comment": return {"id": target.id, "target_type": target.target_type, "target_id": target.target_id, "author_id": target.author_id, "excerpt": (target.body or "")[:160], "url": target_public_url(target_type, target)}
    return {"id": target.id, "username": target.username, "nickname": target.nickname, "url": target_public_url(target_type, target)}


def target_author_id(target_type, target):
    return target.id if target_type == "user" else target.author_id
