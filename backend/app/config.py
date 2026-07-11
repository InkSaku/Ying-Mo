import os
import secrets
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv


BACKEND_ROOT = Path(__file__).resolve().parent.parent

load_dotenv(BACKEND_ROOT / ".env")


def _required_database_url(variable_name="DATABASE_URL", fallback_variable=None):
    value = os.getenv(variable_name, "").strip()
    source_variable = variable_name
    if not value and fallback_variable:
        value = os.getenv(fallback_variable, "").strip()
        source_variable = fallback_variable
    if not value:
        required_variables = " or ".join(filter(None, (variable_name, fallback_variable)))
        raise RuntimeError(f"{required_variables} is required and must point to MySQL.")
    if not value.startswith("mysql+pymysql://"):
        raise RuntimeError(f"{source_variable} must use the mysql+pymysql driver.")
    if "charset=utf8mb4" not in value.lower():
        raise RuntimeError(f"{source_variable} must include charset=utf8mb4.")
    return value


def _cors_origins(default):
    value = os.getenv("CORS_ORIGINS", default)
    return tuple(origin.strip() for origin in value.split(",") if origin.strip())


class BaseConfig:
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
    }
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 15 * 1024 * 1024))
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_MINUTES", "15")))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", "30")))
    JWT_TOKEN_LOCATION = ["headers", "cookies"]
    JWT_COOKIE_SAMESITE = "Lax"
    JWT_SESSION_COOKIE = False
    JWT_COOKIE_MAX_AGE = int(os.getenv("JWT_COOKIE_MAX_AGE", str(60 * 60 * 24 * 30)))
    JWT_REFRESH_COOKIE_NAME = "yingmo_refresh_token"
    JWT_REFRESH_COOKIE_PATH = "/api/v1/auth"
    JWT_REFRESH_CSRF_COOKIE_NAME = "yingmo_refresh_csrf"
    JWT_REFRESH_CSRF_COOKIE_PATH = "/"
    JWT_COOKIE_CSRF_PROTECT = True


class DevelopmentConfig(BaseConfig):
    APP_ENV = "development"
    DEBUG = True
    SECRET_KEY = os.getenv("SECRET_KEY") or secrets.token_urlsafe(32)
    CORS_ORIGINS = _cors_origins("http://localhost:5173,http://127.0.0.1:5173")
    JWT_COOKIE_SECURE = False

    @classmethod
    def database_uri(cls):
        return _required_database_url()


class TestingConfig(BaseConfig):
    APP_ENV = "testing"
    TESTING = True
    SECRET_KEY = secrets.token_urlsafe(32)
    CORS_ORIGINS = _cors_origins("http://localhost:5173,http://127.0.0.1:5173")
    JWT_COOKIE_SECURE = False

    @classmethod
    def database_uri(cls):
        return _required_database_url("TEST_DATABASE_URL", "DATABASE_URL")


class ProductionConfig(BaseConfig):
    APP_ENV = "production"
    DEBUG = False
    SECRET_KEY = os.getenv("SECRET_KEY")
    CORS_ORIGINS = _cors_origins("")
    JWT_COOKIE_SECURE = True

    @classmethod
    def database_uri(cls):
        return _required_database_url()

    @classmethod
    def validate(cls):
        database_uri = cls.database_uri()
        missing = [
            name
            for name, value in {
                "SECRET_KEY": cls.SECRET_KEY,
                "JWT_SECRET_KEY": cls.JWT_SECRET_KEY,
                "DATABASE_URL": database_uri,
                "CORS_ORIGINS": cls.CORS_ORIGINS,
            }.items()
            if not value
        ]
        if missing:
            raise RuntimeError(f"Missing required production configuration: {', '.join(missing)}")


CONFIGS = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(name):
    try:
        return CONFIGS[name]
    except KeyError as error:
        raise ValueError(f"Unsupported application environment: {name}") from error
