from sqlalchemy import case, func, or_
from sqlalchemy.orm import joinedload, selectinload

from app.extensions import db
from app.games.routes import game_dict, hero_dict, map_dict
from app.guides.serializers import guide_dict
from app.guides.routes import GUIDE_OPTIONS
from app.life.routes import CHAPTER_OPTIONS, POST_OPTIONS, chapter_dict, chapter_stats, post_dict, visible_post_filters
from app.models import Game, GameGuide, GameHero, GameMap, LifeChapter, LifePost, User, UserStatus
from app.users.service import public_user_dict

from .normalization import escape_like


SCOPES = ("life_chapter", "life_post", "game", "game_hero", "game_map", "game_guide", "user")


def _pattern(query):
    return f"%{escape_like(query)}%"


def _name_rank(model, query, name_field=None):
    name_field = name_field or model.name_zh
    escaped = escape_like(query)
    return case(
        (func.lower(model.normalized_name) == query, 0),
        (name_field.ilike(f"{escaped}%", escape="\\"), 1),
        (model.search_text.ilike(f"{escaped}%", escape="\\"), 2),
        else_=3,
    )


def _content(type_name, item, viewer, chapter_stats_map=None):
    if type_name == "life_chapter":
        data, url = chapter_dict(item, viewer, stats=chapter_stats_map), f"/life/chapter/{item.slug}"
    elif type_name == "life_post":
        data, url = post_dict(item, viewer), f"/life/post/{item.id}"
    elif type_name == "game":
        data, url = game_dict(item), f"/game/{item.slug}"
    elif type_name == "game_hero":
        data, url = hero_dict(item), f"/game/{item.game.slug}/hero/{item.slug}"
    elif type_name == "game_map":
        data, url = map_dict(item), f"/game/{item.game.slug}/map/{item.slug}"
    elif type_name == "game_guide":
        data, url = guide_dict(item), f"/guide/{item.id}"
    else:
        data, url = public_user_dict(item), f"/user/{item.username}"
    return {"type": type_name, "url": url, "content": data}


def _stmt(scope, query, viewer):
    pattern = _pattern(query)
    if scope == "life_chapter":
        stmt = db.select(LifeChapter).where(LifeChapter.status == "active", or_(LifeChapter.name.ilike(pattern, escape="\\"), LifeChapter.normalized_name.ilike(pattern, escape="\\"), LifeChapter.description.ilike(pattern, escape="\\"), LifeChapter.country.ilike(pattern, escape="\\"), LifeChapter.province.ilike(pattern, escape="\\"), LifeChapter.city.ilike(pattern, escape="\\")))
        return stmt.order_by(case((LifeChapter.normalized_name == query, 0), (LifeChapter.name.ilike(f"{escape_like(query)}%", escape="\\"), 1), else_=2), LifeChapter.updated_at.desc(), LifeChapter.id.desc()), CHAPTER_OPTIONS
    if scope == "life_post":
        stmt = db.select(LifePost).where(*visible_post_filters(viewer), or_(LifePost.title.ilike(pattern, escape="\\"), LifePost.body.ilike(pattern, escape="\\"), LifePost.location.ilike(pattern, escape="\\"), LifePost.mood.ilike(pattern, escape="\\")))
        return stmt.order_by(case((LifePost.title.ilike(f"{escape_like(query)}%", escape="\\"), 0), else_=1), LifePost.updated_at.desc(), LifePost.id.desc()), POST_OPTIONS
    if scope == "game":
        stmt = db.select(Game).where(Game.status == "active", Game.search_text.ilike(pattern, escape="\\"))
        return stmt.order_by(_name_rank(Game, query), Game.updated_at.desc(), Game.id.desc()), (joinedload(Game.icon_media), joinedload(Game.cover_media))
    if scope == "game_hero":
        stmt = db.select(GameHero).join(GameHero.game).where(Game.status == "active", GameHero.status == "active", GameHero.review_status == "approved", GameHero.search_text.ilike(pattern, escape="\\"))
        return stmt.order_by(_name_rank(GameHero, query), GameHero.updated_at.desc(), GameHero.id.desc()), (joinedload(GameHero.game), joinedload(GameHero.avatar_media))
    if scope == "game_map":
        stmt = db.select(GameMap).join(GameMap.game).where(Game.status == "active", GameMap.review_status == "approved", GameMap.search_text.ilike(pattern, escape="\\"))
        return stmt.order_by(_name_rank(GameMap, query), GameMap.updated_at.desc(), GameMap.id.desc()), (joinedload(GameMap.game), joinedload(GameMap.cover_media))
    if scope == "game_guide":
        stmt = db.select(GameGuide).where(GameGuide.status == "published", or_(GameGuide.title.ilike(pattern, escape="\\"), GameGuide.instructions.ilike(pattern, escape="\\"), GameGuide.search_text.ilike(pattern, escape="\\")))
        return stmt.order_by(case((GameGuide.title.ilike(f"{escape_like(query)}%", escape="\\"), 0), else_=1), GameGuide.updated_at.desc(), GameGuide.id.desc()), GUIDE_OPTIONS
    stmt = db.select(User).where(User.status == UserStatus.ACTIVE.value, or_(User.username.ilike(pattern, escape="\\"), User.nickname.ilike(pattern, escape="\\"), User.bio.ilike(pattern, escape="\\"), User.region.ilike(pattern, escape="\\")))
    return stmt.order_by(case((User.username_normalized == query, 0), (User.username.ilike(f"{escape_like(query)}%", escape="\\"), 1), else_=2), User.updated_at.desc(), User.id.desc()), ()


def search_scope(scope, query, viewer, page=1, page_size=20):
    stmt, options = _stmt(scope, query, viewer)
    total = db.session.scalar(db.select(func.count()).select_from(stmt.order_by(None).subquery()))
    items = db.session.scalars(stmt.options(*options).offset((page - 1) * page_size).limit(page_size)).unique().all()
    stats = chapter_stats([item.id for item in items], viewer) if scope == "life_chapter" else None
    return total, [_content(scope, item, viewer, stats) for item in items]


def suggestions(query, viewer, limit):
    results = []
    for scope in SCOPES:
        _, items = search_scope(scope, query, viewer, page_size=limit)
        for item in items:
            content = item["content"]
            if scope == "life_chapter": label, subtitle = content["name"], "生活章节"
            elif scope == "life_post": label, subtitle = content["title"], "日常"
            elif scope == "game": label, subtitle = content["name_zh"], content.get("name_en") or "游戏"
            elif scope in {"game_hero", "game_map"}: label, subtitle = content["name_zh"], content["game"]["name_zh"]
            elif scope == "game_guide": label, subtitle = content["title"], "游戏教材"
            else: label, subtitle = content["nickname"], f"@{content['username']}"
            results.append({"type": scope, "label": label, "subtitle": subtitle, "url": item["url"]})
            if len(results) >= limit:
                return results
    return results
