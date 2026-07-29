import json
from urllib.parse import parse_qs, urlsplit
import uuid

from flask import Flask, g
from flask_jwt_extended import create_access_token
import pytest

from app.extensions import jwt, limiter
from app.locations import locations_bp
from app.locations import routes as location_routes
from app.locations import service as location_service
from app.extensions import _register_jwt_error_handlers


@pytest.fixture()
def location_app():
    application = Flask(__name__)
    application.config.update(
        TESTING=True,
        JWT_SECRET_KEY="location-test-secret-" * 3,
        RATELIMIT_STORAGE_URI="memory://",
        RATELIMIT_HEADERS_ENABLED=True,
        RATE_LIMIT_LOCATION_NEARBY="60 per hour",
        RATE_LIMIT_LOCATION_SUGGESTIONS="30 per minute",
        BAIDU_MAP_SERVER_AK="",
        BAIDU_MAP_TIMEOUT_SECONDS=5,
    )
    original_user_lookup = jwt._user_lookup_callback

    @jwt.user_lookup_loader
    def load_test_user(_header, payload):
        return {"id": payload["sub"]}

    jwt.init_app(application)
    limiter.init_app(application)
    _register_jwt_error_handlers(jwt)
    application.register_blueprint(locations_bp, url_prefix="/api/v1/locations")

    @application.before_request
    def request_id():
        g.request_id = str(uuid.uuid4())

    limiter.reset()
    yield application
    limiter.reset()
    jwt._user_lookup_callback = original_user_lookup


@pytest.fixture()
def location_client(location_app):
    return location_app.test_client()


def _authenticated_headers(location_app):
    with location_app.app_context():
        token = create_access_token(identity="42")
    return {"Authorization": f"Bearer {token}"}


def test_location_endpoints_require_authentication(location_client):
    response = location_client.post(
        "/api/v1/locations/nearby",
        json={"latitude": 39.95, "longitude": 116.34, "coord_type": "wgs84ll"},
    )
    assert response.status_code == 401
    assert response.json["error"]["code"] == "AUTHENTICATION_REQUIRED"


def test_nearby_validates_coordinates_and_radius(location_app, location_client):
    headers = _authenticated_headers(location_app)
    response = location_client.post(
        "/api/v1/locations/nearby",
        headers=headers,
        json={
            "latitude": 95,
            "longitude": "116.34",
            "coord_type": "unknown",
            "radius": 50,
        },
    )
    assert response.status_code == 422
    fields = {item["field"] for item in response.json["error"]["details"]}
    assert fields == {"latitude", "longitude", "coord_type", "radius"}


def test_nearby_returns_normalized_provider_results(location_app, location_client, monkeypatch):
    headers = _authenticated_headers(location_app)
    captured = {}

    def fake_nearby(latitude, longitude, coord_type, radius):
        captured.update(
            latitude=latitude,
            longitude=longitude,
            coord_type=coord_type,
            radius=radius,
        )
        return {
            "center": {
                "latitude": 39.9523,
                "longitude": 116.3467,
                "coord_type": "bd09ll",
            },
            "address": "北京市海淀区上园村3号",
            "city": "北京市",
            "places": [
                {
                    "provider_id": "poi-1",
                    "name": "北京交通大学图书馆",
                    "address": "上园村3号",
                    "latitude": 39.9523,
                    "longitude": 116.3467,
                    "distance_meters": 28,
                }
            ],
        }

    monkeypatch.setattr(location_routes, "nearby_locations", fake_nearby)
    response = location_client.post(
        "/api/v1/locations/nearby",
        headers=headers,
        json={
            "latitude": 39.95,
            "longitude": 116.34,
            "coord_type": "wgs84ll",
            "radius": 500,
        },
    )
    assert response.status_code == 200
    assert captured == {
        "latitude": 39.95,
        "longitude": 116.34,
        "coord_type": "wgs84ll",
        "radius": 500,
    }
    assert response.json["data"]["places"][0]["name"] == "北京交通大学图书馆"


def test_suggestions_validate_query_and_support_search_without_coordinates(
    location_app, location_client, monkeypatch
):
    headers = _authenticated_headers(location_app)
    invalid = location_client.post(
        "/api/v1/locations/suggestions",
        headers=headers,
        json={"query": "北", "region": "", "coord_type": []},
    )
    assert invalid.status_code == 422
    invalid_fields = {item["field"] for item in invalid.json["error"]["details"]}
    assert invalid_fields == {"query", "region", "coord_type"}

    captured = {}

    def fake_suggestions(query, region, latitude, longitude, coord_type):
        captured.update(
            query=query,
            region=region,
            latitude=latitude,
            longitude=longitude,
            coord_type=coord_type,
        )
        return {
            "places": [
                {
                    "provider_id": "poi-2",
                    "name": "北京交通大学",
                    "address": "北京市海淀区上园村3号",
                    "latitude": 39.95,
                    "longitude": 116.34,
                }
            ]
        }

    monkeypatch.setattr(location_routes, "suggest_locations", fake_suggestions)
    response = location_client.post(
        "/api/v1/locations/suggestions",
        headers=headers,
        json={"query": "北京交通", "region": "北京市"},
    )
    assert response.status_code == 200
    assert captured == {
        "query": "北京交通",
        "region": "北京市",
        "latitude": None,
        "longitude": None,
        "coord_type": "bd09ll",
    }


def test_missing_server_ak_keeps_manual_fallback_available(location_app, location_client):
    location_app.config["BAIDU_MAP_SERVER_AK"] = ""
    response = location_client.post(
        "/api/v1/locations/nearby",
        headers=_authenticated_headers(location_app),
        json={"latitude": 39.95, "longitude": 116.34, "coord_type": "wgs84ll"},
    )
    assert response.status_code == 503
    assert response.json["error"]["code"] == "MAP_SERVICE_UNAVAILABLE"
    assert "手动填写" in response.json["error"]["message"]


def test_reverse_geocoding_accepts_wgs84_and_normalizes_pois(location_app, monkeypatch):
    location_app.config["BAIDU_MAP_SERVER_AK"] = "server-test-ak"
    captured = {}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def read(self, _limit):
            return json.dumps(
                {
                    "status": "0",
                    "result": {
                        "location": {"lat": 39.9523, "lng": 116.3467},
                        "formatted_address_poi": "北京市海淀区北京交通大学",
                        "addressComponent": {"city": "北京市"},
                        "pois": [
                            {
                                "uid": "provider-poi-id",
                                "name": "北京交通大学图书馆",
                                "addr": "上园村3号",
                                "distance": "25",
                                "point": {"y": 39.9524, "x": 116.3468},
                            }
                        ],
                    },
                },
                ensure_ascii=False,
            ).encode()

    def fake_urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setattr(location_service, "urlopen", fake_urlopen)
    with location_app.app_context():
        result = location_service.nearby_locations(39.95, 116.34, "wgs84ll", 500)

    query = parse_qs(urlsplit(captured["url"]).query)
    assert query["coordtype"] == ["wgs84ll"]
    assert query["extensions_poi"] == ["1"]
    assert query["ak"] == ["server-test-ak"]
    assert result["center"]["coord_type"] == "bd09ll"
    assert result["places"][0]["provider_id"] == "provider-poi-id"
