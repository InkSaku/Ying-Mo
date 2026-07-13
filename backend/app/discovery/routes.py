from flask import Blueprint
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import joinedload

from app.auth.routes import _current_user
from app.common.responses import success_response
from app.extensions import db
from app.games.routes import game_counts, game_dict
from app.guides.routes import GUIDE_OPTIONS
from app.guides.serializers import guide_dict
from app.life.routes import CHAPTER_OPTIONS, POST_OPTIONS, chapter_dict, chapter_stats, post_dict, public_chapter_filters, visible_post_filters
from app.models import ContentLike, FeaturedContent, Game, GameGuide, LifeChapter, LifePost, User, UserStatus
from app.users.service import public_user_dict


discovery_bp = Blueprint("discovery", __name__)


def _viewer():
    return _current_user() if get_jwt_identity() else None


@discovery_bp.get("")
@jwt_required(optional=True, locations=["headers"])
def discover():
    viewer = _viewer()
    posts = db.session.scalars(
        db.select(LifePost).where(*visible_post_filters(viewer)).options(*POST_OPTIONS).order_by(LifePost.created_at.desc(), LifePost.id.desc()).limit(6)
    ).unique().all()

    chapter_stats_query = (
        db.select(
            LifePost.chapter_id.label("chapter_id"),
            func.count(LifePost.id).label("content_count"),
            func.count(func.distinct(LifePost.author_id)).label("contributor_count"),
        )
        .where(*visible_post_filters(viewer))
        .group_by(LifePost.chapter_id)
        .subquery()
    )
    chapters = db.session.scalars(
        db.select(LifeChapter)
        .where(*public_chapter_filters())
        .outerjoin(chapter_stats_query, chapter_stats_query.c.chapter_id == LifeChapter.id)
        .options(*CHAPTER_OPTIONS)
        .order_by(func.coalesce(chapter_stats_query.c.content_count, 0).desc(), func.coalesce(chapter_stats_query.c.contributor_count, 0).desc(), LifeChapter.updated_at.desc(), LifeChapter.id.desc())
        .limit(6)
    ).unique().all()
    chapter_counts = chapter_stats([chapter.id for chapter in chapters], viewer)

    guides = db.session.scalars(
        db.select(GameGuide).where(GameGuide.status == "published").options(*GUIDE_OPTIONS).order_by(GameGuide.created_at.desc(), GameGuide.id.desc()).limit(6)
    ).unique().all()

    guide_stats = (
        db.select(
            GameGuide.game_id.label("game_id"),
            func.count(GameGuide.id).label("guide_count"),
            func.count(ContentLike.id).label("like_count"),
        )
        .outerjoin(ContentLike, and_(ContentLike.target_type == "game_guide", ContentLike.target_id == GameGuide.id))
        .where(GameGuide.status == "published")
        .group_by(GameGuide.game_id)
        .subquery()
    )
    games = db.session.scalars(
        db.select(Game).where(Game.status == "active").outerjoin(guide_stats, guide_stats.c.game_id == Game.id).options(joinedload(Game.icon_media), joinedload(Game.cover_media)).order_by(func.coalesce(guide_stats.c.guide_count, 0).desc(), func.coalesce(guide_stats.c.like_count, 0).desc(), Game.id.desc()).limit(6)
    ).all()
    game_counts_data = game_counts([game.id for game in games])

    life_visible = and_(LifePost.status == "published", LifePost.visibility.in_(("public", "login_only"))) if viewer else and_(LifePost.status == "published", LifePost.visibility == "public")
    life_score = (
        db.select(LifePost.author_id.label("user_id"), func.count(LifePost.id).label("post_count"))
        .where(life_visible).group_by(LifePost.author_id).subquery()
    )
    guide_score = db.select(GameGuide.author_id.label("user_id"), func.count(GameGuide.id).label("guide_count")).where(GameGuide.status == "published").group_by(GameGuide.author_id).subquery()
    post_likes = (
        db.select(func.count(ContentLike.id))
        .select_from(ContentLike)
        .join(LifePost, and_(ContentLike.target_type == "life_post", ContentLike.target_id == LifePost.id))
        .where(LifePost.author_id == User.id, life_visible)
        .correlate(User)
        .scalar_subquery()
    )
    guide_likes = (
        db.select(func.count(ContentLike.id))
        .select_from(ContentLike)
        .join(GameGuide, and_(ContentLike.target_type == "game_guide", ContentLike.target_id == GameGuide.id))
        .where(GameGuide.author_id == User.id, GameGuide.status == "published")
        .correlate(User)
        .scalar_subquery()
    )
    creators = db.session.scalars(
        db.select(User).where(User.status == UserStatus.ACTIVE.value)
        .outerjoin(life_score, life_score.c.user_id == User.id)
        .outerjoin(guide_score, guide_score.c.user_id == User.id)
        .order_by((func.coalesce(life_score.c.post_count, 0) + func.coalesce(guide_score.c.guide_count, 0) + func.coalesce(post_likes, 0) + func.coalesce(guide_likes, 0)).desc(), User.created_at.desc(), User.id.desc()).limit(6)
    ).all()
    featured = []
    for selected in db.session.scalars(db.select(FeaturedContent).order_by(FeaturedContent.created_at.desc()).limit(12)).all():
        if selected.target_type == "life_post":
            target = db.session.scalar(db.select(LifePost).where(LifePost.id == selected.target_id, LifePost.status == "published", LifePost.visibility == "public").options(*POST_OPTIONS))
            content = post_dict(target, viewer) if target else None
        else:
            target = db.session.scalar(db.select(GameGuide).where(GameGuide.id == selected.target_id, GameGuide.status == "published").options(*GUIDE_OPTIONS))
            content = guide_dict(target) if target else None
        if content:
            featured.append({"target_type": selected.target_type, "featured_at": selected.created_at.isoformat().replace("+00:00", "Z"), "content": content})
        if len(featured) == 6: break
    return success_response({
        "featured_content": featured,
        "latest_life_posts": [post_dict(post, viewer) for post in posts],
        "popular_life_chapters": [chapter_dict(chapter, viewer, stats=chapter_counts) for chapter in chapters],
        "latest_guides": [guide_dict(guide) for guide in guides],
        "popular_games": [game_dict(game, game_counts_data) for game in games],
        "active_creators": [public_user_dict(creator) for creator in creators],
    })
