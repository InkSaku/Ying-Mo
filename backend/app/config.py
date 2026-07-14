import os
import secrets
from datetime import timedelta
from pathlib import Path
from urllib.parse import unquote, urlsplit

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


def _validated_test_database_url():
    """Require an explicitly isolated MySQL database for test execution."""
    test_url = _required_database_url("TEST_DATABASE_URL")
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url and test_url == database_url:
        raise RuntimeError("TEST_DATABASE_URL must differ from DATABASE_URL.")

    database_name = unquote(urlsplit(test_url).path.rsplit("/", 1)[-1]).lower()
    if "test" not in database_name and "qa" not in database_name:
        raise RuntimeError("TEST_DATABASE_URL must name a database containing test or qa.")
    return test_url


class BaseConfig:
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
    }
    # multipart 需要为边界信息预留一点空间，图片本身仍由上传服务限制为 15 MB。
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 16 * 1024 * 1024))
    UPLOAD_ROOT = Path(os.getenv("UPLOAD_ROOT", BACKEND_ROOT / "uploads")).expanduser()
    IMAGE_MAX_BYTES = int(os.getenv("IMAGE_MAX_BYTES", 15 * 1024 * 1024))
    IMAGE_MAX_PIXELS = int(os.getenv("IMAGE_MAX_PIXELS", 40_000_000))
    IMAGE_MAX_WIDTH = int(os.getenv("IMAGE_MAX_WIDTH", 12000))
    IMAGE_MAX_HEIGHT = int(os.getenv("IMAGE_MAX_HEIGHT", 12000))
    IMAGE_MAX_ASPECT_RATIO = float(os.getenv("IMAGE_MAX_ASPECT_RATIO", 20))
    IMAGE_THUMBNAIL_MAX_SIDE = int(os.getenv("IMAGE_THUMBNAIL_MAX_SIDE", 640))
    UPLOAD_UNBOUND_LIMIT = int(os.getenv("UPLOAD_UNBOUND_LIMIT", 30))
    UPLOAD_USER_TOTAL_BYTES = int(os.getenv("UPLOAD_USER_TOTAL_BYTES", 2 * 1024 * 1024 * 1024))
    UPLOAD_USER_DAILY_BYTES = int(os.getenv("UPLOAD_USER_DAILY_BYTES", 200 * 1024 * 1024))
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")
    RATELIMIT_HEADERS_ENABLED = True
    RATE_LIMIT_REGISTER = os.getenv("RATE_LIMIT_REGISTER", "5 per hour")
    RATE_LIMIT_LOGIN = os.getenv("RATE_LIMIT_LOGIN", "10 per minute")
    RATE_LIMIT_REFRESH = os.getenv("RATE_LIMIT_REFRESH", "30 per minute")
    RATE_LIMIT_UPLOAD = os.getenv("RATE_LIMIT_UPLOAD", "20 per hour")
    RATE_LIMIT_SEARCH = os.getenv("RATE_LIMIT_SEARCH", "60 per minute")
    RATE_LIMIT_SEARCH_SUGGESTIONS = os.getenv("RATE_LIMIT_SEARCH_SUGGESTIONS", "120 per minute")
    SYSTEM_ADMIN_INVITE_CODE = os.getenv(
        "SYSTEM_ADMIN_INVITE_CODE",
        "",
    ).strip()
    RATE_LIMIT_ADMIN_INVITE = os.getenv(
        "RATE_LIMIT_ADMIN_INVITE",
        "2400 per hour",
    )
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
    REPORT_DAILY_LIMIT = int(os.getenv("REPORT_DAILY_LIMIT", "20"))


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
        return _validated_test_database_url()


class ProductionConfig(BaseConfig):
    APP_ENV = "production"
    DEBUG = False
    SECRET_KEY = os.getenv("SECRET_KEY")
    CORS_ORIGINS = _cors_origins("")
    JWT_COOKIE_SECURE = True

    @classmethod
    def database_uri(cls):
        return _required_database_url()

    @staticmethod
    def validate(config):
        problems = []
        for name in ("SECRET_KEY", "JWT_SECRET_KEY"):
            try:
                _validate_secret(name, config.get(name))
            except RuntimeError as error:
                problems.append(str(error))
        if config.get("SECRET_KEY") == config.get("JWT_SECRET_KEY"):
            problems.append("SECRET_KEY and JWT_SECRET_KEY must be different")
        if config.get("DEBUG"):
            problems.append("DEBUG must be disabled in production")
        if not config.get("CORS_ORIGINS"):
            problems.append("CORS_ORIGINS is required")
        if "*" in config.get("CORS_ORIGINS", ()):
            problems.append("CORS_ORIGINS must not contain *")
        if not os.getenv("UPLOAD_ROOT") and not config.get("UPLOAD_ROOT"):
            problems.append("UPLOAD_ROOT is required")
        if str(config.get("RATELIMIT_STORAGE_URI", "")).startswith("memory://"):
            problems.append("RATELIMIT_STORAGE_URI must use shared storage in production")
        if problems:
            raise RuntimeError("Invalid production configuration: " + "; ".join(problems))


_WEAK_SECRETS = {
    "changeme", "change-me", "development-secret", "secret", "secret-key",
    "password", "123456", "replace-with-a-strong-secret",
    "replace-with-a-different-strong-secret", "your-secret-key", "your-jwt-secret",
}


def _validate_secret(name, value):
    if not isinstance(value, str) or not value.strip():
        raise RuntimeError(f"{name} is required")
    normalized = value.strip().casefold()
    if normalized in _WEAK_SECRETS or normalized.startswith(("replace-with-", "example-", "sample-")):
        raise RuntimeError(f"{name} must not use a placeholder or common weak value")
    if len(value.encode("utf-8")) < 32:
        raise RuntimeError(f"{name} must be at least 32 bytes")


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
