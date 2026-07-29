import math
import re
import unicodedata

from flask import Blueprint, current_app, request
from flask_jwt_extended import jwt_required

from app.common.rate_limits import limiter, user_key
from app.common.responses import error_response, success_response

from .service import LocationProviderError, nearby_locations, suggest_locations


locations_bp = Blueprint("locations", __name__)
COORD_TYPES = {"wgs84ll", "gcj02ll", "bd09ll"}


def _field_error(field, code, message):
    return {"field": field, "code": code, "message": message}


def _validation(details):
    return error_response("VALIDATION_ERROR", "地点参数不合法。", 422, details)


def _payload(allowed):
    value = request.get_json(silent=True)
    if not isinstance(value, dict):
        return None, _validation([_field_error("body", "invalid_format", "请求体必须是 JSON 对象。")])
    unknown = set(value) - allowed
    if unknown:
        field = sorted(unknown)[0]
        return None, _validation([_field_error(field, "unknown_field", "不支持该字段。")])
    return value, None


def _coordinate(payload, required=True):
    latitude = payload.get("latitude")
    longitude = payload.get("longitude")
    coord_type = payload.get("coord_type", "bd09ll")
    errors = []
    if not isinstance(coord_type, str) or coord_type not in COORD_TYPES:
        errors.append(_field_error("coord_type", "invalid_choice", "坐标类型不受支持。"))
    if not required and latitude is None and longitude is None:
        return None, None, coord_type, errors
    if (
        isinstance(latitude, bool)
        or not isinstance(latitude, (int, float))
        or not math.isfinite(latitude)
        or not -90 <= latitude <= 90
    ):
        errors.append(_field_error("latitude", "invalid_coordinate", "纬度必须在 -90 到 90 之间。"))
    if (
        isinstance(longitude, bool)
        or not isinstance(longitude, (int, float))
        or not math.isfinite(longitude)
        or not -180 <= longitude <= 180
    ):
        errors.append(_field_error("longitude", "invalid_coordinate", "经度必须在 -180 到 180 之间。"))
    return latitude, longitude, coord_type, errors


def _normalized_query(value):
    if not isinstance(value, str):
        return None
    value = re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value).strip())
    visible = re.sub(r"[^\w\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]", "", value, flags=re.UNICODE)
    has_cjk = bool(re.search(r"[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]", visible))
    minimum = 2 if has_cjk else 3
    return value if minimum <= len(visible) <= 45 else None


def _provider_response(callback):
    try:
        return success_response(callback())
    except LocationProviderError as error:
        return error_response(error.code, error.message, error.status_code)


@locations_bp.post("/nearby")
@jwt_required(locations=["headers"])
@limiter.limit(
    lambda: current_app.config["RATE_LIMIT_LOCATION_NEARBY"],
    key_func=user_key,
    methods=["POST"],
)
def nearby():
    payload, error = _payload({"latitude", "longitude", "coord_type", "radius"})
    if error:
        return error
    latitude, longitude, coord_type, errors = _coordinate(payload)
    radius = payload.get("radius", 500)
    if isinstance(radius, bool) or not isinstance(radius, int) or not 100 <= radius <= 3000:
        errors.append(_field_error("radius", "invalid_range", "附近地点半径必须在 100 到 3000 米之间。"))
    if errors:
        return _validation(errors)
    return _provider_response(
        lambda: nearby_locations(latitude, longitude, coord_type, radius)
    )


@locations_bp.post("/suggestions")
@jwt_required(locations=["headers"])
@limiter.limit(
    lambda: current_app.config["RATE_LIMIT_LOCATION_SUGGESTIONS"],
    key_func=user_key,
    methods=["POST"],
)
def suggestions():
    payload, error = _payload(
        {"query", "region", "latitude", "longitude", "coord_type"}
    )
    if error:
        return error
    query = _normalized_query(payload.get("query"))
    region = payload.get("region")
    errors = []
    if query is None:
        errors.append(_field_error("query", "invalid_length", "中文地点至少输入 2 个字，其他地点至少输入 3 个字符。"))
    if not isinstance(region, str) or not 1 <= len(region.strip()) <= 50:
        errors.append(_field_error("region", "invalid_length", "请输入要搜索的城市。"))
    latitude, longitude, coord_type, coordinate_errors = _coordinate(
        payload,
        required=False,
    )
    errors.extend(coordinate_errors)
    if errors:
        return _validation(errors)
    return _provider_response(
        lambda: suggest_locations(
            query,
            region.strip(),
            latitude,
            longitude,
            coord_type,
        )
    )
