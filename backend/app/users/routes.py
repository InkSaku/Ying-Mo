from flask import Blueprint, current_app, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func
from sqlalchemy.orm import joinedload, selectinload

from app.auth.routes import _current_user, normalized_username
from app.auth.service import utcnow
from app.common.responses import error_response, success_response
from app.extensions import db
from app.models import ContentFavorite, ContentLike, ContentDraft, GameGuide, GameGuideStep, LifePost, LifePostMedia, Media, MediaPurpose, User, UserStatus
from app.uploads.storage import file_exists, remove_media_files

from .service import public_user_dict


def _optional_user():
    return _current_user() if get_jwt_identity() else None


def _pagination(page, page_size, total):
    return {"pagination": {"page": page, "page_size": page_size, "total": total, "total_pages": (total + page_size - 1) // page_size, "has_next": page * page_size < total, "has_previous": page > 1}}


def _page_args():
    try:
        page, page_size = int(request.args.get("page", 1)), int(request.args.get("page_size", 20))
    except ValueError:
        return None, None, error_response("VALIDATION_ERROR", "页码必须是整数。", 422)
    if page < 1 or not 1 <= page_size <= 100:
        return None, None, error_response("VALIDATION_ERROR", "页码范围不合法。", 422)
    return page, page_size, None


def _visible_post_filters(viewer, owner_id):
    if viewer and viewer.id == owner_id:
        return [LifePost.author_id == owner_id, LifePost.status == "published"]
    if viewer:
        return [LifePost.author_id == owner_id, LifePost.status == "published", LifePost.visibility.in_(("public", "login_only"))]
    return [LifePost.author_id == owner_id, LifePost.status == "published", LifePost.visibility == "public"]


def _user_stats(profile, viewer):
    post_total = db.session.scalar(db.select(func.count(LifePost.id)).where(*_visible_post_filters(viewer, profile.id)))
    guide_total = db.session.scalar(db.select(func.count(GameGuide.id)).where(GameGuide.author_id == profile.id, GameGuide.status == "published"))
    visible_post_ids = db.select(LifePost.id).where(*_visible_post_filters(viewer, profile.id))
    visible_guide_ids = db.select(GameGuide.id).where(GameGuide.author_id == profile.id, GameGuide.status == "published")
    likes = db.session.scalar(db.select(func.count(ContentLike.id)).where((ContentLike.target_type == "life_post") & ContentLike.target_id.in_(visible_post_ids) | (ContentLike.target_type == "game_guide") & ContentLike.target_id.in_(visible_guide_ids)))
    return {"life_post_count": post_total or 0, "guide_count": guide_total or 0, "received_like_count": likes or 0}


users_bp = Blueprint("users", __name__)


def _validation_error(details):
    return error_response("VALIDATION_ERROR", "请求参数不合法。", 422, details)


def _field_error(field, code, message):
    return {"field": field, "code": code, "message": message}


def _current_avatar(user):
    return db.session.scalar(
        db.select(Media).where(
            Media.owner_id == user.id,
            Media.bound_type == "user_avatar",
            Media.bound_id == user.id,
        )
    )


@users_bp.patch("/me")
@jwt_required(locations=["headers"])
def update_me():
    user = _current_user()
    if user is None:
        return error_response("ACCOUNT_RESTRICTED", "当前账号无法继续使用。", 403)
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return _validation_error([_field_error("body", "invalid_format", "请求体必须是 JSON 对象。")])
    allowed = {"nickname", "bio", "region"}
    unknown = set(payload) - allowed
    if unknown:
        field = sorted(unknown)[0]
        return _validation_error([_field_error(field, "unknown_field", "不支持修改该字段。")])
    if not payload:
        return _validation_error([_field_error("body", "required", "至少需要提交一个可修改字段。")])

    errors = []
    updates = {}
    if "nickname" in payload:
        nickname = payload["nickname"]
        if not isinstance(nickname, str):
            errors.append(_field_error("nickname", "invalid_type", "昵称必须是字符串。"))
        else:
            nickname = nickname.strip()
            if not 1 <= len(nickname) <= 30:
                errors.append(_field_error("nickname", "invalid_length", "昵称长度需为 1 至 30 个字符。"))
            else:
                updates["nickname"] = nickname
    for field, maximum, label in (("bio", 500, "简介"), ("region", 100, "地区")):
        if field not in payload:
            continue
        value = payload[field]
        if value is not None and not isinstance(value, str):
            errors.append(_field_error(field, "invalid_type", f"{label}必须是字符串或 null。"))
        elif isinstance(value, str) and len(value) > maximum:
            errors.append(_field_error(field, "invalid_length", f"{label}最多 {maximum} 个字符。"))
        else:
            updates[field] = value if isinstance(value, str) and value else None
    if errors:
        return _validation_error(errors)
    for field, value in updates.items():
        setattr(user, field, value)
    user.updated_at = utcnow()
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Unable to update user profile")
        return error_response("INTERNAL_ERROR", "资料保存失败，请稍后重试。", 500)
    return success_response(user.to_dict())


@users_bp.put("/me/avatar")
@jwt_required(locations=["headers"])
def set_avatar():
    user = _current_user()
    if user is None:
        return error_response("ACCOUNT_RESTRICTED", "当前账号无法继续使用。", 403)
    payload = request.get_json(silent=True)
    media_id = payload.get("media_id") if isinstance(payload, dict) else None
    if not isinstance(media_id, int) or isinstance(media_id, bool) or media_id <= 0:
        return _validation_error([_field_error("media_id", "invalid_type", "media_id 必须是有效正整数。")])
    media = db.session.get(Media, media_id)
    if media is None:
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    if media.owner_id != user.id:
        return error_response("PERMISSION_DENIED", "无权使用该图片。", 403)
    if media.purpose != MediaPurpose.AVATAR:
        return _validation_error([_field_error("media_id", "invalid_purpose", "只能将头像用途的图片设为头像。")])
    if media.is_bound:
        return error_response("RESOURCE_CONFLICT", "该图片已绑定，不能重复使用。", 409)
    if not file_exists(media.storage_key) or not file_exists(media.thumbnail_key):
        return error_response("RESOURCE_CONFLICT", "图片文件不完整，无法设置头像。", 409)

    old_avatar = _current_avatar(user)
    media.bound_type = "user_avatar"
    media.bound_id = user.id
    media.bound_at = utcnow()
    user.avatar_url = f"/api/v1/uploads/images/{media.public_id}/thumbnail"
    user.updated_at = utcnow()
    if old_avatar is not None:
        db.session.delete(old_avatar)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Unable to set user avatar")
        return error_response("INTERNAL_ERROR", "头像设置失败，请稍后重试。", 500)
    if old_avatar is not None:
        remove_media_files(old_avatar)
    return success_response(user.to_dict())


@users_bp.delete("/me/avatar")
@jwt_required(locations=["headers"])
def remove_avatar():
    user = _current_user()
    if user is None:
        return error_response("ACCOUNT_RESTRICTED", "当前账号无法继续使用。", 403)
    old_avatar = _current_avatar(user)
    user.avatar_url = None
    user.updated_at = utcnow()
    if old_avatar is not None:
        db.session.delete(old_avatar)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Unable to remove user avatar")
        return error_response("INTERNAL_ERROR", "头像删除失败，请稍后重试。", 500)
    if old_avatar is not None:
        remove_media_files(old_avatar)
    return "", 204


@users_bp.get("/<username>")
@jwt_required(optional=True, locations=["headers"])
def get_public_user(username):
    normalized = normalized_username(username)
    user = db.session.scalar(db.select(User).where(User.username_normalized == normalized, User.status == UserStatus.ACTIVE.value))
    if user is None:
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    data = public_user_dict(user)
    data["stats"] = _user_stats(user, _optional_user())
    return success_response(data)


@users_bp.get("/<username>/life-posts")
@jwt_required(optional=True, locations=["headers"])
def public_life_posts(username):
    profile = db.session.scalar(db.select(User).where(User.username_normalized == normalized_username(username), User.status == UserStatus.ACTIVE.value))
    if not profile:
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    page, page_size, error = _page_args()
    if error:
        return error
    sort = request.args.get("sort", "latest")
    if sort not in {"latest", "updated"}:
        return error_response("VALIDATION_ERROR", "排序方式不支持。", 422)
    from app.life.routes import POST_OPTIONS, post_dict
    viewer = _optional_user()
    stmt = db.select(LifePost).where(*_visible_post_filters(viewer, profile.id))
    total = db.session.scalar(db.select(func.count()).select_from(stmt.subquery()))
    order = (LifePost.updated_at.desc(), LifePost.id.desc()) if sort == "updated" else (LifePost.created_at.desc(), LifePost.id.desc())
    items = db.session.scalars(stmt.options(*POST_OPTIONS).order_by(*order).offset((page - 1) * page_size).limit(page_size)).unique().all()
    return success_response([post_dict(item, viewer) for item in items], meta=_pagination(page, page_size, total))


@users_bp.get("/<username>/guides")
@jwt_required(optional=True, locations=["headers"])
def public_guides(username):
    profile = db.session.scalar(db.select(User).where(User.username_normalized == normalized_username(username), User.status == UserStatus.ACTIVE.value))
    if not profile:
        return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    page, page_size, error = _page_args()
    if error:
        return error
    sort = request.args.get("sort", "latest")
    if sort not in {"latest", "updated"}:
        return error_response("VALIDATION_ERROR", "排序方式不支持。", 422)
    from app.guides.routes import GUIDE_OPTIONS
    from app.guides.serializers import guide_dict
    stmt = db.select(GameGuide).where(GameGuide.author_id == profile.id, GameGuide.status == "published")
    total = db.session.scalar(db.select(func.count()).select_from(stmt.subquery()))
    order = (GameGuide.updated_at.desc(), GameGuide.id.desc()) if sort == "updated" else (GameGuide.created_at.desc(), GameGuide.id.desc())
    items = db.session.scalars(stmt.options(*GUIDE_OPTIONS).order_by(*order).offset((page - 1) * page_size).limit(page_size)).unique().all()
    return success_response([guide_dict(item) for item in items], meta=_pagination(page, page_size, total))


@users_bp.get("/me/summary")
@jwt_required(locations=["headers"])
def my_summary():
    user = _current_user()
    from app.drafts.service import draft_dict
    from app.guides.routes import GUIDE_OPTIONS
    from app.guides.serializers import guide_dict
    from app.life.routes import POST_OPTIONS, post_dict
    life_total = db.session.scalar(db.select(func.count(LifePost.id)).where(LifePost.author_id == user.id, LifePost.status == "published")) or 0
    guide_total = db.session.scalar(db.select(func.count(GameGuide.id)).where(GameGuide.author_id == user.id, GameGuide.status == "published")) or 0
    draft_total = db.session.scalar(db.select(func.count(ContentDraft.id)).where(ContentDraft.owner_id == user.id)) or 0
    hidden_total = (db.session.scalar(db.select(func.count(LifePost.id)).where(LifePost.author_id == user.id, LifePost.status == "hidden")) or 0) + (db.session.scalar(db.select(func.count(GameGuide.id)).where(GameGuide.author_id == user.id, GameGuide.status == "hidden")) or 0)
    favorite_total = db.session.scalar(db.select(func.count(ContentFavorite.id)).where(ContentFavorite.user_id == user.id)) or 0
    from app.models import Comment
    comment_total = db.session.scalar(db.select(func.count(Comment.id)).where(Comment.author_id == user.id, Comment.status == "active")) or 0
    liked_posts = db.select(LifePost.id).where(LifePost.author_id == user.id)
    liked_guides = db.select(GameGuide.id).where(GameGuide.author_id == user.id)
    received_likes = db.session.scalar(db.select(func.count(ContentLike.id)).where((ContentLike.target_type == "life_post") & ContentLike.target_id.in_(liked_posts) | (ContentLike.target_type == "game_guide") & ContentLike.target_id.in_(liked_guides))) or 0
    recent_posts = db.session.scalars(db.select(LifePost).where(LifePost.author_id == user.id, LifePost.status == "published").options(*POST_OPTIONS).order_by(LifePost.updated_at.desc(), LifePost.id.desc()).limit(3)).unique().all()
    recent_guides = db.session.scalars(db.select(GameGuide).where(GameGuide.author_id == user.id, GameGuide.status == "published").options(*GUIDE_OPTIONS).order_by(GameGuide.updated_at.desc(), GameGuide.id.desc()).limit(3)).unique().all()
    drafts = db.session.scalars(db.select(ContentDraft).where(ContentDraft.owner_id == user.id).options(selectinload(ContentDraft.media_links)).order_by(ContentDraft.updated_at.desc(), ContentDraft.id.desc()).limit(3)).all()
    return success_response({"life_post_count": life_total, "guide_count": guide_total, "draft_count": draft_total, "hidden_count": hidden_total, "favorite_count": favorite_total, "comment_count": comment_total, "received_like_count": received_likes, "recent_content": [*(post_dict(post, user) for post in recent_posts), *(guide_dict(guide) for guide in recent_guides)], "recent_drafts": [draft_dict(draft) for draft in drafts]})


@users_bp.get("/me/life-posts")
@jwt_required(locations=["headers"])
def my_life_posts():
    user = _current_user()
    page, page_size, error = _page_args()
    if error:
        return error
    status, visibility, sort = request.args.get("status", "all"), request.args.get("visibility", "all"), request.args.get("sort", "latest")
    if status not in {"all", "published", "hidden"} or visibility not in {"all", "public", "login_only", "private"} or sort not in {"latest", "updated"}:
        return error_response("VALIDATION_ERROR", "筛选条件不合法。", 422)
    from app.life.routes import POST_OPTIONS, post_dict
    stmt = db.select(LifePost).where(LifePost.author_id == user.id)
    if status != "all": stmt = stmt.where(LifePost.status == status)
    if visibility != "all": stmt = stmt.where(LifePost.visibility == visibility)
    total = db.session.scalar(db.select(func.count()).select_from(stmt.subquery()))
    order = (LifePost.updated_at.desc(), LifePost.id.desc()) if sort == "updated" else (LifePost.created_at.desc(), LifePost.id.desc())
    items = db.session.scalars(stmt.options(*POST_OPTIONS).order_by(*order).offset((page - 1) * page_size).limit(page_size)).unique().all()
    return success_response([post_dict(item, user, item.status != "published") for item in items], meta=_pagination(page, page_size, total))


@users_bp.get("/me/guides")
@jwt_required(locations=["headers"])
def my_guides():
    user = _current_user()
    page, page_size, error = _page_args()
    if error:
        return error
    status, validity, game_id, sort = request.args.get("status", "all"), request.args.get("validity_status"), request.args.get("game_id"), request.args.get("sort", "latest")
    if status not in {"all", "published", "hidden"} or sort not in {"latest", "updated"}:
        return error_response("VALIDATION_ERROR", "筛选条件不合法。", 422)
    from app.guides.routes import GUIDE_OPTIONS
    from app.guides.serializers import guide_dict
    stmt = db.select(GameGuide).where(GameGuide.author_id == user.id)
    if status != "all": stmt = stmt.where(GameGuide.status == status)
    if validity: stmt = stmt.where(GameGuide.validity_status == validity)
    if game_id:
        try: stmt = stmt.where(GameGuide.game_id == int(game_id))
        except ValueError: return error_response("VALIDATION_ERROR", "游戏筛选不合法。", 422)
    total = db.session.scalar(db.select(func.count()).select_from(stmt.subquery()))
    order = (GameGuide.updated_at.desc(), GameGuide.id.desc()) if sort == "updated" else (GameGuide.created_at.desc(), GameGuide.id.desc())
    items = db.session.scalars(stmt.options(*GUIDE_OPTIONS).order_by(*order).offset((page - 1) * page_size).limit(page_size)).unique().all()
    return success_response([guide_dict(item, user, True) for item in items], meta=_pagination(page, page_size, total))


@users_bp.get("/me/chapter-submissions")
@jwt_required(locations=["headers"])
def my_chapter_submissions():
    user = _current_user()
    page, page_size, error = _page_args()
    if error: return error
    review_status = request.args.get("review_status", "all")
    if review_status not in {"all", "pending", "approved", "rejected"}:
        return error_response("VALIDATION_ERROR", "审核状态不合法。", 422)
    from app.models import LifeChapter
    from app.life.routes import CHAPTER_OPTIONS, chapter_dict
    stmt = db.select(LifeChapter).where(LifeChapter.creator_id == user.id)
    if review_status != "all": stmt = stmt.where(LifeChapter.review_status == review_status)
    total = db.session.scalar(db.select(func.count()).select_from(stmt.subquery()))
    items = db.session.scalars(stmt.options(*CHAPTER_OPTIONS).order_by(LifeChapter.updated_at.desc(), LifeChapter.id.desc()).offset((page-1)*page_size).limit(page_size)).unique().all()
    return success_response([chapter_dict(item, user) | {"review_status": item.review_status, "review_note": item.review_note, "reviewed_at": item.reviewed_at.isoformat().replace("+00:00", "Z") if item.reviewed_at else None} for item in items], meta=_pagination(page,page_size,total))
