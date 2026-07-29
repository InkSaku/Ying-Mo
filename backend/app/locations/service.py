import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from flask import current_app


BAIDU_API_ROOT = "https://api.map.baidu.com"


class LocationProviderError(Exception):
    def __init__(self, code, message, status_code=502):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def _provider_request(path, params):
    ak = current_app.config.get("BAIDU_MAP_SERVER_AK", "")
    if not ak:
        raise LocationProviderError(
            "MAP_SERVICE_UNAVAILABLE",
            "地点服务尚未配置，请先手动填写地点。",
            503,
        )

    query = urlencode({**params, "ak": ak})
    request = Request(
        f"{BAIDU_API_ROOT}{path}?{query}",
        headers={"Accept": "application/json", "User-Agent": "YingMO/2 location-picker"},
    )
    try:
        with urlopen(
            request,
            timeout=current_app.config.get("BAIDU_MAP_TIMEOUT_SECONDS", 5),
        ) as response:
            raw = response.read(1_000_001)
            if len(raw) > 1_000_000:
                raise ValueError("provider response is too large")
            payload = json.loads(raw.decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("provider response must be an object")
    except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as error:
        current_app.logger.warning("Baidu map request failed: %s", type(error).__name__)
        raise LocationProviderError(
            "MAP_PROVIDER_UNAVAILABLE",
            "地点服务暂时不可用，请稍后重试或手动填写。",
        ) from error

    try:
        provider_status = int(payload.get("status"))
    except (TypeError, ValueError):
        provider_status = None
    if provider_status == 0:
        return payload
    if provider_status in {4, 301, 302, 401, 402}:
        raise LocationProviderError(
            "MAP_QUOTA_EXCEEDED",
            "今日地点服务额度已用完，请手动填写地点。",
            503,
        )
    current_app.logger.warning("Baidu map returned status=%s", provider_status)
    raise LocationProviderError(
        "MAP_PROVIDER_ERROR",
        "地点服务未能识别该位置，请调整位置或手动填写。",
    )


def _number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _point(value):
    if not isinstance(value, dict):
        return None
    latitude = _number(value.get("lat", value.get("y")))
    longitude = _number(value.get("lng", value.get("x")))
    if latitude is None or longitude is None:
        return None
    return {"latitude": latitude, "longitude": longitude}


def _text(value, maximum):
    return value.strip()[:maximum] if isinstance(value, str) else ""


def nearby_locations(latitude, longitude, coord_type, radius):
    payload = _provider_request(
        "/reverse_geocoding/v3/",
        {
            "location": f"{latitude:.8f},{longitude:.8f}",
            "coordtype": coord_type,
            "output": "json",
            "extensions_poi": 1,
            "entire_poi": 1,
            "sort_strategy": "distance",
            "radius": radius,
        },
    )
    result = payload.get("result") if isinstance(payload.get("result"), dict) else {}
    center = _point(result.get("location"))
    if center is None:
        raise LocationProviderError(
            "MAP_PROVIDER_ERROR",
            "地点服务返回了无法识别的位置。",
        )

    places = []
    for item in result.get("pois") or []:
        if not isinstance(item, dict):
            continue
        point = _point(item.get("point"))
        name = _text(item.get("name"), 100)
        if not name or point is None:
            continue
        places.append(
            {
                "provider_id": _text(item.get("uid"), 80) or None,
                "name": name,
                "address": _text(item.get("addr"), 200),
                "distance_meters": int(_number(item.get("distance")) or 0),
                **point,
            }
        )

    component = result.get("addressComponent")
    component = component if isinstance(component, dict) else {}
    return {
        "center": {**center, "coord_type": "bd09ll"},
        "address": _text(
            result.get("formatted_address_poi")
            or result.get("formatted_address"),
            200,
        ),
        "city": _text(component.get("city"), 50),
        "places": places[:10],
    }


def suggest_locations(query, region, latitude=None, longitude=None, coord_type="bd09ll"):
    params = {
        "query": query,
        "region": region,
        "region_limit": "true",
        "output": "json",
    }
    if latitude is not None and longitude is not None:
        params.update(
            {
                "location": f"{latitude:.8f},{longitude:.8f}",
                "coord_type": {
                    "wgs84ll": 1,
                    "gcj02ll": 2,
                    "bd09ll": 3,
                }[coord_type],
            }
        )
    payload = _provider_request("/place/v3/suggestion", params)
    places = []
    for item in payload.get("results") or []:
        if not isinstance(item, dict):
            continue
        point = _point(item.get("location"))
        name = _text(item.get("name"), 100)
        if not name or point is None or not item.get("uid"):
            continue
        places.append(
            {
                "provider_id": _text(item.get("uid"), 80),
                "name": name,
                "address": _text(item.get("address"), 200),
                "province": _text(item.get("province"), 50),
                "city": _text(item.get("city"), 50),
                "district": _text(item.get("district"), 50),
                **point,
            }
        )
    return {"places": places[:10]}
