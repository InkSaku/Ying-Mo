from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.auth.routes import _current_user
from app.common.responses import error_response, success_response

from .normalization import normalize_search_query
from .service import SCOPES, search_scope, suggestions


search_bp = Blueprint("search", __name__)


def _error(message):
    return error_response("VALIDATION_ERROR", message, 422)


def _viewer():
    return _current_user() if get_jwt_identity() else None


def _pagination(page, page_size, total):
    return {"pagination": {"page": page, "page_size": page_size, "total": total, "total_pages": (total + page_size - 1) // page_size, "has_next": page * page_size < total, "has_previous": page > 1}}


@search_bp.get("")
@jwt_required(optional=True, locations=["headers"])
def search():
    try:
        query = normalize_search_query(request.args.get("q", ""))
        page, page_size = int(request.args.get("page", 1)), int(request.args.get("page_size", 20))
        limit = int(request.args.get("limit_per_group", 5))
    except ValueError as error:
        return _error(str(error))
    if page < 1 or not 1 <= page_size <= 100 or not 1 <= limit <= 10:
        return _error("分页或分组数量不合法。")
    scope = request.args.get("scope", "all")
    if scope != "all" and scope not in SCOPES:
        return _error("搜索范围不合法。")
    viewer = _viewer()
    if scope == "all":
        groups = {}
        for kind in SCOPES:
            total, items = search_scope(kind, query, viewer, page_size=limit)
            groups[kind] = {"total": total, "items": items}
        return success_response({"query": query, "groups": groups})
    total, items = search_scope(scope, query, viewer, page, page_size)
    return success_response(items, meta=_pagination(page, page_size, total))


@search_bp.get("/suggestions")
@jwt_required(optional=True, locations=["headers"])
def search_suggestions():
    try:
        query = normalize_search_query(request.args.get("q", ""))
        limit = int(request.args.get("limit", 8))
    except ValueError as error:
        return _error(str(error))
    if not 1 <= limit <= 12:
        return _error("建议数量不合法。")
    return success_response(suggestions(query, _viewer(), limit))
