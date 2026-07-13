import pytest

from app.config import TestingConfig


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
