from sqlalchemy.exc import SQLAlchemyError
import pytest

from app.blueprints.health import routes as health_routes


def test_health_check_is_a_database_independent_liveness_probe(client):
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    assert response.headers["Cache-Control"] == "no-store"
    assert response.json["data"] == {"status": "ok", "service": "yingmo-backend"}
    assert response.json["meta"]["request_id"] == response.headers["X-Request-ID"]


def test_missing_api_route_uses_json_error_contract(client):
    response = client.get("/api/v1/not-exist")

    assert response.status_code == 404
    assert response.is_json
    assert response.json["error"]["code"] == "RESOURCE_NOT_FOUND"
    assert response.json["error"]["details"] == []
    assert response.json["error"]["request_id"] == response.headers["X-Request-ID"]


def test_method_not_allowed_uses_json_error_contract(client):
    response = client.post("/api/v1/health")

    assert response.status_code == 405
    assert response.is_json
    assert response.json["error"]["code"] == "METHOD_NOT_ALLOWED"


def test_readiness_check_does_not_report_connected_when_database_fails(client, monkeypatch):
    def raise_database_error(*_args, **_kwargs):
        raise SQLAlchemyError("database unavailable")

    monkeypatch.setattr(health_routes.db.session, "execute", raise_database_error)

    response = client.get("/api/v1/health/ready")

    assert response.status_code == 503
    assert response.headers["Cache-Control"] == "no-store"
    assert response.json["error"]["code"] == "DATABASE_UNAVAILABLE"
    assert "connected" not in response.get_data(as_text=True)


@pytest.mark.parametrize("origin", ["http://localhost:5173", "http://127.0.0.1:5173"])
def test_health_check_allows_configured_development_origins(client, origin):
    response = client.get("/api/v1/health", headers={"Origin": origin})

    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == origin
