from flask import request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.common.responses import error_response, success_response
from app.extensions import db
from app.models import ContentFavorite, GameGuide, LifePost, User, UserStatus
from app.guides.serializers import guide_dict
from app.life.routes import POST_OPTIONS, post_dict
from app.guides.routes import GUIDE_OPTIONS
from sqlalchemy import and_, exists, or_
from .service import counts, set_favorite, set_like
from .targets import TARGET_TYPES, resolve_target
from . import interactions_bp


def user():
    identity = get_jwt_identity()
    return db.session.get(User, int(identity)) if identity else None


def active_user():
    value = user()
    return value if value and value.status == UserStatus.ACTIVE.value else None


def info_or_error(target_type, target_id):
    info = resolve_target(target_type, target_id, user())
    return info, None if info else error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)


@interactions_bp.get("/<target_type>/<int:target_id>")
@jwt_required(optional=True, locations=["headers"])
def summary(target_type, target_id):
    info, error = info_or_error(target_type, target_id)
    return error or success_response(counts(target_type, target_id, user()))


@interactions_bp.route("/<target_type>/<int:target_id>/like", methods=["PUT", "DELETE"])
@jwt_required(locations=["headers"])
def like(target_type, target_id):
    actor = active_user()
    if not actor: return error_response("PERMISSION_DENIED", "当前账号不可进行互动。", 403)
    info = resolve_target(target_type, target_id, actor)
    if not info: return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    return success_response(set_like(info, actor, request.method == "PUT"))


@interactions_bp.route("/<target_type>/<int:target_id>/favorite", methods=["PUT", "DELETE"])
@jwt_required(locations=["headers"])
def favorite(target_type, target_id):
    actor = active_user()
    if not actor: return error_response("PERMISSION_DENIED", "当前账号不可进行互动。", 403)
    info = resolve_target(target_type, target_id, actor)
    if not info: return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    return success_response(set_favorite(info, actor, request.method == "PUT"))


@interactions_bp.get("/favorites")
@jwt_required(locations=["headers"])
def favorites():
    actor = active_user()
    if not actor: return error_response("PERMISSION_DENIED", "当前账号不可用。", 403)
    kind = request.args.get("target_type", "all")
    if kind != "all" and kind not in TARGET_TYPES: return error_response("VALIDATION_ERROR", "内容类型不合法。", 400)
    try: page, size = int(request.args.get("page", 1)), int(request.args.get("page_size", 20))
    except ValueError: return error_response("VALIDATION_ERROR", "分页参数不合法。", 400)
    if page < 1 or not 1 <= size <= 100: return error_response("VALIDATION_ERROR", "分页参数不合法。", 400)
    stmt = db.select(ContentFavorite).where(ContentFavorite.user_id == actor.id)
    if kind != "all": stmt = stmt.where(ContentFavorite.target_type == kind)
    visible_life = exists(db.select(LifePost.id).where(LifePost.id == ContentFavorite.target_id, LifePost.status == "published", or_(LifePost.visibility.in_(("public", "login_only")), LifePost.author_id == actor.id)))
    visible_guide = exists(db.select(GameGuide.id).where(GameGuide.id == ContentFavorite.target_id, or_(GameGuide.status == "published", GameGuide.author_id == actor.id)))
    stmt = stmt.where(or_(and_(ContentFavorite.target_type == "life_post", visible_life), and_(ContentFavorite.target_type == "game_guide", visible_guide)))
    total = db.session.scalar(db.select(db.func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.session.scalars(stmt.order_by(ContentFavorite.created_at.desc(), ContentFavorite.id.desc()).offset((page - 1) * size).limit(size)).all()
    life_ids = [r.target_id for r in rows if r.target_type == "life_post"]
    guide_ids = [r.target_id for r in rows if r.target_type == "game_guide"]
    life = {x.id: x for x in db.session.scalars(db.select(LifePost).where(LifePost.id.in_(life_ids)).options(*POST_OPTIONS)).unique().all()} if life_ids else {}
    guides = {x.id: x for x in db.session.scalars(db.select(GameGuide).where(GameGuide.id.in_(guide_ids)).options(*GUIDE_OPTIONS)).unique().all()} if guide_ids else {}
    items = []
    for row in rows:
        target = life.get(row.target_id) if row.target_type == "life_post" else guides.get(row.target_id)
        if target: items.append({"target_type": row.target_type, "favorited_at": row.created_at.isoformat(), "content": post_dict(target, actor) if row.target_type == "life_post" else guide_dict(target, actor)})
    return success_response(items, meta={"pagination": {"page": page, "page_size": size, "total": total, "total_pages": (total + size - 1) // size, "has_next": page * size < total, "has_previous": page > 1}})
