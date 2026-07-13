import pytest
from flask import Flask

from app.config import ProductionConfig, TestingConfig
from app import _register_request_id


def test_testing_config_requires_a_dedicated_database(monkeypatch):
    monkeypatch.delenv("TEST_DATABASE_URL", raising=False)

    with pytest.raises(RuntimeError, match="TEST_DATABASE_URL"):
        TestingConfig.database_uri()


def test_testing_config_rejects_the_development_database(monkeypatch):
    url = "mysql+pymysql://user:password@localhost/yingmo_dev?charset=utf8mb4"
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("TEST_DATABASE_URL", url)

    with pytest.raises(RuntimeError, match="must differ"):
        TestingConfig.database_uri()


def test_testing_config_rejects_database_names_without_test_or_qa(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "mysql+pymysql://user:password@localhost/yingmo_dev?charset=utf8mb4")
    monkeypatch.setenv("TEST_DATABASE_URL", "mysql+pymysql://user:password@localhost/yingmo_preview?charset=utf8mb4")

    with pytest.raises(RuntimeError, match="test or qa"):
        TestingConfig.database_uri()


def test_testing_config_accepts_a_distinct_qa_database(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "mysql+pymysql://user:password@localhost/yingmo_dev?charset=utf8mb4")
    test_url = "mysql+pymysql://user:password@localhost/yingmo_stage7_qa?charset=utf8mb4"
    monkeypatch.setenv("TEST_DATABASE_URL", test_url)

    assert TestingConfig.database_uri() == test_url


def production_values(secret="a" * 48, jwt_secret="b" * 48, **overrides):
    values = {
        "SECRET_KEY": secret,
        "JWT_SECRET_KEY": jwt_secret,
        "DEBUG": False,
        "CORS_ORIGINS": ("https://example.test",),
        "UPLOAD_ROOT": "/tmp/yingmo-uploads",
        "RATELIMIT_STORAGE_URI": "redis://localhost:6379/0",
    }
    values.update(overrides)
    return values


@pytest.mark.parametrize("secret", ["", "changeme", "replace-with-a-strong-secret", "short-secret"])
def test_production_rejects_missing_placeholder_or_short_secrets(secret):
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        ProductionConfig.validate(production_values(secret=secret))


def test_production_rejects_equal_secrets():
    secret = "same-secret-" * 4
    with pytest.raises(RuntimeError, match="must be different"):
        ProductionConfig.validate(production_values(secret=secret, jwt_secret=secret))


def test_production_rejects_debug_and_process_local_rate_limit_storage():
    with pytest.raises(RuntimeError, match="DEBUG.*shared storage"):
        ProductionConfig.validate(production_values(DEBUG=True, RATELIMIT_STORAGE_URI="memory://"))


def test_production_accepts_distinct_strong_final_values():
    ProductionConfig.validate(production_values())


def test_final_override_values_are_validated():
    final_config = production_values(SECRET_KEY="override-placeholder")
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        ProductionConfig.validate(final_config)


@pytest.mark.parametrize("unsafe", ["field=value", "has space", "abc_def", "abc/def"])
def test_unsafe_request_ids_are_replaced(unsafe):
    app = Flask(__name__)
    app.config["APP_ENV"] = "testing"
    _register_request_id(app)
    app.add_url_rule("/", view_func=lambda: "ok")
    response = app.test_client().get("/", headers={"X-Request-ID": unsafe})
    assert response.headers["X-Request-ID"] != unsafe


def test_valid_uuid_request_id_is_preserved():
    app = Flask(__name__)
    app.config["APP_ENV"] = "testing"
    _register_request_id(app)
    app.add_url_rule("/", view_func=lambda: "ok")
    request_id = "123e4567-e89b-42d3-a456-426614174000"
    assert app.test_client().get("/", headers={"X-Request-ID": request_id}).headers["X-Request-ID"] == request_id
