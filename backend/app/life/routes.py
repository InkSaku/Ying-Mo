import re
import unicodedata
import uuid
from datetime import datetime, timezone

from flask import Blueprint, current_app, request, url_for
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError

from app.auth.routes import _current_user
from app.auth.service import utcnow
from app.common.responses import error_response, success_response
from app.extensions import db
from app.models import LifeChapter, LifePost, LifePostMedia, Media, MediaPurpose, UserStatus
from app.models.user import serialize_datetime
from app.uploads.storage import file_exists, remove_media_files
from app.users.service import public_user_dict


life_bp = Blueprint("life", __name__)
CHAPTER_TYPES = {"city", "scenic", "travel", "campus", "event", "custom"}
VISIBILITIES = {"public", "login_only", "private"}


def field_error(field, code, message):
    return {"field": field, "code": code, "message": message}


def validation_error(details):
    return error_response("VALIDATION_ERROR", "请求参数不合法。", 422, details)


def normalize_name(value):
    value = unicodedata.normalize("NFKC", value).strip()
    value = re.sub(r"\s+", " ", value).casefold()
    return re.sub(r"[\s\-_,，。！!？?、】【（）()]+", "", value)


def chapter_slug(name):
    readable = re.sub(r"[^a-z0-9]+", "-", name.casefold()).strip("-")
    return readable[:90] + "-" + uuid.uuid4().hex[:8] if readable else "chapter-" + uuid.uuid4().hex


def current_user_optional():
    return _current_user() if get_jwt_identity() else None


def can_view_post(post, user):
    if user and post.author_id == user.id:
        return True
    if post.status != "published":
        return False
    if post.visibility == "public":
        return True
    return post.visibility == "login_only" and user is not None


def can_read_media(media, user):
    if media.bound_type == "life_chapter_cover":
        chapter = db.session.get(LifeChapter, media.bound_id)
        return bool(chapter and chapter.status == "active")
    if media.bound_type == "life_post":
        link = db.session.scalar(db.select(LifePostMedia).where(LifePostMedia.media_id == media.id))
        return bool(link and can_view_post(link.post, user))
    return False


def visible_post_filters(user):
    filters = [LifePost.status == "published"]
    filters.append(LifePost.visibility.in_(("public", "login_only")) if user else LifePost.visibility == "public")
    return filters


def parse_page():
    try:
        page = int(request.args.get("page", "1"))
        page_size = int(request.args.get("page_size", "20"))
    except ValueError:
        return None, None, validation_error([field_error("page", "invalid_type", "页码必须是整数。")])
    if page < 1 or not 1 <= page_size <= 100:
        return None, None, validation_error([field_error("page", "invalid_range", "页码至少为 1，单页数量为 1 至 100。")])
    return page, page_size, None


def pagination_meta(page, page_size, total):
    return {"pagination": {"page": page, "page_size": page_size, "total": total, "total_pages": (total + page_size - 1) // page_size, "has_next": page * page_size < total, "has_previous": page > 1}}


def chapter_dict(chapter, user=None, include_children=False):
    cover = chapter.cover_media
    posts = db.session.scalar(db.select(func.count(LifePost.id)).where(LifePost.chapter_id == chapter.id, *visible_post_filters(user)))
    contributors = db.session.scalar(db.select(func.count(func.distinct(LifePost.author_id))).where(LifePost.chapter_id == chapter.id, *visible_post_filters(user)))
    data = {"id": chapter.id, "name": chapter.name, "slug": chapter.slug, "chapter_type": chapter.chapter_type, "description": chapter.description, "country": chapter.country, "province": chapter.province, "city": chapter.city, "cover_url": f"/api/v1/uploads/images/{cover.public_id}" if cover else None, "cover_thumbnail_url": f"/api/v1/uploads/images/{cover.public_id}/thumbnail" if cover else None, "parent": {"id": chapter.parent.id, "name": chapter.parent.name, "slug": chapter.parent.slug} if chapter.parent else None, "content_count": posts or 0, "contributor_count": contributors or 0, "creator": public_user_dict(chapter.creator), "created_at": serialize_datetime(chapter.created_at), "updated_at": serialize_datetime(chapter.updated_at)}
    if include_children:
        data["children"] = [chapter_dict(child, user) for child in chapter.children if child.status == "active"]
    return data


def post_dict(post, user=None, detail=False):
    links = post.media_links
    images = [{"id": link.media.id, "public_id": link.media.public_id, "url": f"/api/v1/uploads/images/{link.media.public_id}", "thumbnail_url": f"/api/v1/uploads/images/{link.media.public_id}/thumbnail", "width": link.media.width, "height": link.media.height, "position": link.position} for link in links]
    data = {"id": post.id, "title": post.title, "author": public_user_dict(post.author), "chapter": {"id": post.chapter.id, "name": post.chapter.name, "slug": post.chapter.slug, "type": post.chapter.chapter_type}, "location": post.location, "mood": post.mood, "tags": post.tags or [], "shot_at": serialize_datetime(post.shot_at), "visibility": post.visibility, "created_at": serialize_datetime(post.created_at), "updated_at": serialize_datetime(post.updated_at), "can_edit": bool(user and post.author_id == user.id)}
    if detail:
        data.update({"body": post.body, "images": images, "status": post.status})
    else:
        data.update({"excerpt": (post.body or "")[:160], "cover_image": images[0]["thumbnail_url"] if images else None, "image_count": len(images)})
    return data


def validate_post_payload(payload, creating=False):
    allowed = {"chapter_id", "title", "body", "location", "mood", "tags", "shot_at", "visibility", "media_ids"}
    unknown = set(payload) - allowed
    if unknown:
        return None, validation_error([field_error(sorted(unknown)[0], "unknown_field", "不支持该字段。")])
    if creating and ({"title", "chapter_id", "media_ids"} - set(payload)):
        return None, validation_error([field_error("body", "required", "标题、章节和图片为必填项。")])
    updates, errors = {}, []
    for field, maximum in (("title", 100), ("body", 5000), ("location", 100), ("mood", 30)):
        if field not in payload: continue
        value = payload[field]
        if field == "title":
            value = value.strip() if isinstance(value, str) else value
            if not isinstance(value, str) or not value or len(value) > maximum: errors.append(field_error(field, "invalid_length", "标题长度需为 1 至 100 个字符。"))
        elif value is not None and (not isinstance(value, str) or len(value) > maximum): errors.append(field_error(field, "invalid_length", f"{field} 长度不合法。"))
        else: value = value or None
        updates[field] = value
    if "chapter_id" in payload and (not isinstance(payload["chapter_id"], int) or isinstance(payload["chapter_id"], bool) or payload["chapter_id"] <= 0): errors.append(field_error("chapter_id", "invalid_type", "chapter_id 必须是正整数。"))
    elif "chapter_id" in payload: updates["chapter_id"] = payload["chapter_id"]
    if "visibility" in payload and payload["visibility"] not in VISIBILITIES: errors.append(field_error("visibility", "invalid_choice", "可见范围不合法。"))
    elif "visibility" in payload: updates["visibility"] = payload["visibility"]
    if "tags" in payload:
        tags = payload["tags"]
        if not isinstance(tags, list) or len(tags) > 10: errors.append(field_error("tags", "invalid_format", "标签最多 10 个。"))
        else:
            clean = []
            for tag in tags:
                tag = tag.strip() if isinstance(tag, str) else ""
                if not 1 <= len(tag) <= 20: errors.append(field_error("tags", "invalid_item", "每个标签长度需为 1 至 20。"))
                elif tag not in clean: clean.append(tag)
            updates["tags"] = clean
    if "shot_at" in payload:
        value = payload["shot_at"]
        try:
            parsed = None if value in (None, "") else datetime.fromisoformat(value.replace("Z", "+00:00"))
            updates["shot_at"] = parsed.replace(tzinfo=timezone.utc) if parsed and parsed.tzinfo is None else parsed.astimezone(timezone.utc) if parsed else None
        except (AttributeError, ValueError): errors.append(field_error("shot_at", "invalid_format", "拍摄时间必须是 ISO 8601 时间。"))
    if "media_ids" in payload:
        ids = payload["media_ids"]
        if not isinstance(ids, list) or not 1 <= len(ids) <= 9 or any(not isinstance(i, int) or isinstance(i, bool) or i <= 0 for i in ids) or len(set(ids)) != len(ids): errors.append(field_error("media_ids", "invalid_format", "图片数量需为 1 至 9 张且不能重复。"))
        else: updates["media_ids"] = ids
    return updates, validation_error(errors) if errors else None


def validate_media_ids(user, media_ids, existing_ids=()):
    media = db.session.scalars(db.select(Media).where(Media.id.in_(media_ids))).all()
    lookup = {item.id: item for item in media}
    if len(lookup) != len(media_ids): return None, error_response("RESOURCE_NOT_FOUND", "请求的图片不存在。", 404)
    for media_id in media_ids:
        item = lookup[media_id]
        if item.owner_id != user.id: return None, error_response("PERMISSION_DENIED", "无权使用该图片。", 403)
        if item.purpose != MediaPurpose.CONTENT or (item.id not in existing_ids and item.is_bound) or not file_exists(item.storage_key) or not file_exists(item.thumbnail_key): return None, error_response("RESOURCE_CONFLICT", "图片不可用于当前日常。", 409)
    return [lookup[i] for i in media_ids], None


@life_bp.get("/chapters")
@jwt_required(optional=True, locations=["headers"])
def list_chapters():
    user = current_user_optional(); page, page_size, error = parse_page()
    if error: return error
    stmt = db.select(LifeChapter).where(LifeChapter.status == "active")
    query = request.args.get("query", "").strip()
    if query: stmt = stmt.where(or_(LifeChapter.name.ilike(f"%{query}%"), LifeChapter.normalized_name.ilike(f"%{normalize_name(query)}%")))
    kind = request.args.get("chapter_type")
    if kind:
        if kind not in CHAPTER_TYPES: return validation_error([field_error("chapter_type", "invalid_choice", "章节类型不合法。")])
        stmt = stmt.where(LifeChapter.chapter_type == kind)
    parent = request.args.get("parent_id")
    if parent == "root": stmt = stmt.where(LifeChapter.parent_id.is_(None))
    elif parent:
        try: stmt = stmt.where(LifeChapter.parent_id == int(parent))
        except ValueError: return validation_error([field_error("parent_id", "invalid_type", "parent_id 不合法。")])
    sort = request.args.get("sort", "latest")
    if sort not in {"latest", "popular"}: return validation_error([field_error("sort", "invalid_choice", "排序方式不支持。")])
    total = db.session.scalar(db.select(func.count()).select_from(stmt.subquery()))
    chapters = db.session.scalars(stmt.order_by(LifeChapter.created_at.desc(), LifeChapter.id.desc()).offset((page-1)*page_size).limit(page_size)).all()
    return success_response([chapter_dict(item, user) for item in chapters], meta=pagination_meta(page, page_size, total))


@life_bp.get("/chapters/check-name")
def check_chapter_name():
    name = request.args.get("name", "")
    if not isinstance(name, str) or not name.strip(): return validation_error([field_error("name", "required", "请输入章节名称。")])
    normalized = normalize_name(name)
    parent = request.args.get("parent_id")
    try: parent_id = None if parent in (None, "", "root") else int(parent)
    except ValueError: return validation_error([field_error("parent_id", "invalid_type", "parent_id 不合法。")])
    key = f"root:{normalized}" if parent_id is None else f"{parent_id}:{normalized}"
    exact = db.session.scalar(db.select(LifeChapter).where(LifeChapter.dedupe_key == key))
    candidates = db.session.scalars(db.select(LifeChapter).where(LifeChapter.parent_id.is_(None) if parent_id is None else LifeChapter.parent_id == parent_id, LifeChapter.normalized_name.contains(normalized)).limit(5)).all()
    return success_response({"exact_match": {"id": exact.id, "name": exact.name, "slug": exact.slug} if exact else None, "candidates": [{"id": item.id, "name": item.name, "slug": item.slug} for item in candidates]})


@life_bp.post("/chapters")
@jwt_required(locations=["headers"])
def create_chapter():
    user = _current_user(); payload = request.get_json(silent=True)
    if user is None or user.status != UserStatus.ACTIVE.value: return error_response("ACCOUNT_RESTRICTED", "当前账号无法继续使用。", 403)
    if not user.can_publish: return error_response("PERMISSION_DENIED", "当前账号不能发布内容。", 403)
    if not isinstance(payload, dict): return validation_error([field_error("body", "invalid_format", "请求体必须是 JSON 对象。")])
    allowed = {"name", "chapter_type", "parent_id", "country", "province", "city", "description", "cover_media_id"}
    if set(payload) - allowed: return validation_error([field_error(sorted(set(payload)-allowed)[0], "unknown_field", "不支持该字段。")])
    name = payload.get("name"); kind = payload.get("chapter_type")
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80 or kind not in CHAPTER_TYPES: return validation_error([field_error("name", "invalid_format", "章节名称或类型不合法。")])
    parent_id = payload.get("parent_id")
    if parent_id is not None and (not isinstance(parent_id, int) or isinstance(parent_id, bool) or parent_id <= 0): return validation_error([field_error("parent_id", "invalid_type", "parent_id 必须是正整数或 null。")])
    parent = db.session.get(LifeChapter, parent_id) if parent_id else None
    if parent_id and (parent is None or parent.status != "active" or parent.parent_id is not None): return validation_error([field_error("parent_id", "invalid_parent", "父章节必须是可用的一级章节。")])
    for field, maximum in (("country",100),("province",100),("city",100),("description",500)):
        if payload.get(field) is not None and (not isinstance(payload[field], str) or len(payload[field]) > maximum): return validation_error([field_error(field,"invalid_length",f"{field} 长度不合法。")])
    normalized = normalize_name(name); dedupe = f"root:{normalized}" if not parent else f"{parent.id}:{normalized}"
    if db.session.scalar(db.select(LifeChapter.id).where(LifeChapter.dedupe_key == dedupe)): return error_response("DUPLICATE_RESOURCE", "同层级已存在同名章节。", 409)
    chapter = LifeChapter(name=name.strip(), normalized_name=normalized, dedupe_key=dedupe, slug=chapter_slug(name), chapter_type=kind, parent_id=parent_id, creator_id=user.id, **{field: (payload.get(field) or None) for field in ("country","province","city","description")})
    cover_id = payload.get("cover_media_id")
    try:
        db.session.add(chapter); db.session.flush()
        if cover_id is not None:
            if not isinstance(cover_id, int) or isinstance(cover_id, bool) or cover_id <= 0: return validation_error([field_error("cover_media_id","invalid_type","cover_media_id 必须是正整数。")])
            media = db.session.get(Media, cover_id)
            if not media: return error_response("RESOURCE_NOT_FOUND", "请求的图片不存在。", 404)
            if media.owner_id != user.id or media.purpose != MediaPurpose.CONTENT or media.is_bound or not file_exists(media.storage_key) or not file_exists(media.thumbnail_key): return error_response("RESOURCE_CONFLICT", "图片不可作为章节封面。", 409)
            media.bound_type="life_chapter_cover"; media.bound_id=chapter.id; media.bound_at=utcnow(); chapter.cover_media_id=media.id
        db.session.commit()
    except IntegrityError:
        db.session.rollback(); return error_response("DUPLICATE_RESOURCE", "同层级已存在同名章节。", 409)
    return success_response(chapter_dict(chapter, user), 201, {"location": url_for("life.get_chapter", slug=chapter.slug)})


@life_bp.get("/chapters/<slug>")
@jwt_required(optional=True, locations=["headers"])
def get_chapter(slug):
    chapter = db.session.scalar(db.select(LifeChapter).where(LifeChapter.slug == slug, LifeChapter.status == "active"))
    if not chapter: return error_response("RESOURCE_NOT_FOUND", "请求的资源不存在。", 404)
    return success_response(chapter_dict(chapter, current_user_optional(), True))


@life_bp.get("/posts")
@jwt_required(optional=True, locations=["headers"])
def list_posts():
    user=current_user_optional(); page,page_size,error=parse_page()
    if error:return error
    scope=request.args.get("scope","latest")
    if scope not in {"latest","mine"}: return validation_error([field_error("scope","invalid_choice","范围不支持。")])
    if scope == "mine":
        if not user:return error_response("AUTHENTICATION_REQUIRED","请先登录后再继续。",401)
        stmt=db.select(LifePost).where(LifePost.author_id==user.id, LifePost.status=="published")
    else: stmt=db.select(LifePost).where(*visible_post_filters(user))
    slug=request.args.get("chapter_slug")
    if slug:
        chapter=db.session.scalar(db.select(LifeChapter).where(LifeChapter.slug==slug,LifeChapter.status=="active"))
        if not chapter:return error_response("RESOURCE_NOT_FOUND","请求的资源不存在。",404)
        stmt=stmt.where(LifePost.chapter_id==chapter.id)
    total=db.session.scalar(db.select(func.count()).select_from(stmt.subquery()))
    posts=db.session.scalars(stmt.order_by(LifePost.created_at.desc(),LifePost.id.desc()).offset((page-1)*page_size).limit(page_size)).all()
    return success_response([post_dict(item,user) for item in posts],meta=pagination_meta(page,page_size,total))


@life_bp.post("/posts")
@jwt_required(locations=["headers"])
def create_post():
    user=_current_user(); payload=request.get_json(silent=True)
    if user is None or user.status != UserStatus.ACTIVE.value:return error_response("ACCOUNT_RESTRICTED","当前账号无法继续使用。",403)
    if not user.can_publish:return error_response("PERMISSION_DENIED","当前账号不能发布内容。",403)
    if not isinstance(payload,dict):return validation_error([field_error("body","invalid_format","请求体必须是 JSON 对象。")])
    updates,error=validate_post_payload(payload,True)
    if error:return error
    chapter=db.session.get(LifeChapter,updates["chapter_id"])
    if not chapter or chapter.status!="active":return error_response("RESOURCE_NOT_FOUND","章节不存在或不可用。",404)
    media,error=validate_media_ids(user,updates.pop("media_ids"))
    if error:return error
    updates.pop("chapter_id", None)
    post=LifePost(author_id=user.id,chapter_id=chapter.id,title=updates.pop("title"),**updates)
    try:
        db.session.add(post); db.session.flush()
        for position,item in enumerate(media): db.session.add(LifePostMedia(post_id=post.id,media_id=item.id,position=position)); item.bound_type="life_post"; item.bound_id=post.id; item.bound_at=utcnow()
        db.session.commit()
    except Exception:
        db.session.rollback(); current_app.logger.exception("Unable to create life post"); return error_response("INTERNAL_ERROR","日常发布失败，请稍后重试。",500)
    return success_response(post_dict(post,user,True),201,{"location":url_for("life.get_post",post_id=post.id)})


@life_bp.get("/posts/<int:post_id>")
@jwt_required(optional=True, locations=["headers"])
def get_post(post_id):
    post=db.session.get(LifePost,post_id); user=current_user_optional()
    if not post or not can_view_post(post,user):return error_response("RESOURCE_NOT_FOUND","请求的资源不存在。",404)
    return success_response(post_dict(post,user,True))


@life_bp.patch("/posts/<int:post_id>")
@jwt_required(locations=["headers"])
def update_post(post_id):
    post=db.session.get(LifePost,post_id); user=_current_user(); payload=request.get_json(silent=True)
    if not post:return error_response("RESOURCE_NOT_FOUND","请求的资源不存在。",404)
    if not user or post.author_id!=user.id:return error_response("PERMISSION_DENIED","无权编辑该日常。",403)
    if not isinstance(payload,dict) or not payload:return validation_error([field_error("body","required","至少提交一个可修改字段。")])
    updates,error=validate_post_payload(payload)
    if error:return error
    if "chapter_id" in updates:
        chapter=db.session.get(LifeChapter,updates["chapter_id"])
        if not chapter or chapter.status!="active":return error_response("RESOURCE_NOT_FOUND","章节不存在或不可用。",404)
    removed=[]
    try:
        if "media_ids" in updates:
            target=updates.pop("media_ids"); existing={link.media_id:link for link in post.media_links}
            media,error=validate_media_ids(user,target,existing)
            if error:return error
            removed=[link.media for media_id,link in existing.items() if media_id not in target]
            for link in list(post.media_links): db.session.delete(link)
            db.session.flush()
            for position,item in enumerate(media): db.session.add(LifePostMedia(post_id=post.id,media_id=item.id,position=position)); item.bound_type="life_post"; item.bound_id=post.id; item.bound_at=utcnow()
            for item in removed: db.session.delete(item)
        for field,value in updates.items(): setattr(post,field,value)
        post.updated_at=utcnow(); db.session.commit()
    except Exception:
        db.session.rollback(); current_app.logger.exception("Unable to update life post"); return error_response("INTERNAL_ERROR","日常更新失败，请稍后重试。",500)
    for item in removed: remove_media_files(item)
    return success_response(post_dict(post,user,True))


@life_bp.delete("/posts/<int:post_id>")
@jwt_required(locations=["headers"])
def delete_post(post_id):
    post=db.session.get(LifePost,post_id); user=_current_user()
    if not post:return error_response("RESOURCE_NOT_FOUND","请求的资源不存在。",404)
    if not user or post.author_id!=user.id:return error_response("PERMISSION_DENIED","无权删除该日常。",403)
    media=[link.media for link in post.media_links]
    try:
        for link in list(post.media_links): db.session.delete(link)
        db.session.flush()
        for item in media: db.session.delete(item)
        db.session.delete(post); db.session.commit()
    except Exception:
        db.session.rollback(); current_app.logger.exception("Unable to delete life post"); return error_response("INTERNAL_ERROR","日常删除失败，请稍后重试。",500)
    for item in media: remove_media_files(item)
    return "",204
