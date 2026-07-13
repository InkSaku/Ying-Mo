from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import Comment, ContentFavorite, ContentLike
from app.notifications.service import create_like_notification, delete_like_notification


def counts(target_type, target_id, user=None):
    likes = db.session.scalar(db.select(db.func.count(ContentLike.id)).where(ContentLike.target_type == target_type, ContentLike.target_id == target_id)) or 0
    comments = db.session.scalar(db.select(db.func.count(Comment.id)).where(Comment.target_type == target_type, Comment.target_id == target_id, Comment.status == "active")) or 0
    liked = favorited = False
    if user:
        liked = db.session.scalar(db.select(ContentLike.id).where(ContentLike.user_id == user.id, ContentLike.target_type == target_type, ContentLike.target_id == target_id)) is not None
        favorited = db.session.scalar(db.select(ContentFavorite.id).where(ContentFavorite.user_id == user.id, ContentFavorite.target_type == target_type, ContentFavorite.target_id == target_id)) is not None
    return {"like_count": likes, "comment_count": comments, "viewer": {"liked": liked, "favorited": favorited}}


def set_like(info, user, enabled):
    item = db.session.scalar(db.select(ContentLike).where(ContentLike.user_id == user.id, ContentLike.target_type == info.target_type, ContentLike.target_id == info.target.id))
    if enabled and not item:
        db.session.add(ContentLike(user_id=user.id, target_type=info.target_type, target_id=info.target.id))
        create_like_notification(info, user)
    elif not enabled and item:
        db.session.delete(item)
        delete_like_notification(info, user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
    result = counts(info.target_type, info.target.id, user)
    result["viewer"]["liked"] = enabled
    return result


def set_favorite(info, user, enabled):
    item = db.session.scalar(db.select(ContentFavorite).where(ContentFavorite.user_id == user.id, ContentFavorite.target_type == info.target_type, ContentFavorite.target_id == info.target.id))
    if enabled and not item: db.session.add(ContentFavorite(user_id=user.id, target_type=info.target_type, target_id=info.target.id))
    elif not enabled and item: db.session.delete(item)
    try: db.session.commit()
    except IntegrityError: db.session.rollback()
    return {"favorited": enabled}

