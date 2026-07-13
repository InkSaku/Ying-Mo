from dataclasses import dataclass

from app.extensions import db
from app.models import GameGuide, LifePost

TARGET_LIFE_POST = "life_post"
TARGET_GAME_GUIDE = "game_guide"
TARGET_TYPES = {TARGET_LIFE_POST, TARGET_GAME_GUIDE}


@dataclass(frozen=True)
class TargetInfo:
    target_type: str
    target: object
    author_id: int
    title: str
    target_url: str


def resolve_target(target_type, target_id, viewer=None):
    if target_type not in TARGET_TYPES or not isinstance(target_id, int) or target_id <= 0:
        return None
    if target_type == TARGET_LIFE_POST:
        target = db.session.get(LifePost, target_id)
        visible = target and target.status == "published" and (
            target.visibility == "public"
            or (viewer and target.author_id == viewer.id)
            or (viewer and target.visibility == "login_only")
        )
        url = f"/life/post/{target_id}"
    else:
        target = db.session.get(GameGuide, target_id)
        visible = target and (target.status == "published" or (viewer and target.author_id == viewer.id))
        url = f"/guide/{target_id}"
    if not visible:
        return None
    return TargetInfo(target_type, target, target.author_id, target.title, url)


def target_summary(info):
    return {"target_type": info.target_type, "target_id": info.target.id, "title": info.title, "target_url": info.target_url}


def cleanup_target_interactions(target_type, target_id):
    from app.models import Comment, ContentFavorite, ContentLike, Notification
    db.session.execute(db.delete(Notification).where(Notification.target_type == target_type, Notification.target_id == target_id))
    db.session.execute(db.delete(Comment).where(Comment.target_type == target_type, Comment.target_id == target_id))
    db.session.execute(db.delete(ContentFavorite).where(ContentFavorite.target_type == target_type, ContentFavorite.target_id == target_id))
    db.session.execute(db.delete(ContentLike).where(ContentLike.target_type == target_type, ContentLike.target_id == target_id))

