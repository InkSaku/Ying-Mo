import os
import secrets
from pathlib import Path

from dotenv import load_dotenv


BACKEND_ROOT = Path(__file__).resolve().parent.parent
INSTANCE_PATH = BACKEND_ROOT / "instance"

load_dotenv(BACKEND_ROOT / ".env")


def _database_url(default_name):
    configured_url = os.getenv("DATABASE_URL")
    if configured_url:
        return configured_url
    return f"sqlite:///{INSTANCE_PATH / default_name}"


def _cors_origins(default):
    value = os.getenv("CORS_ORIGINS", default)
    return tuple(origin.strip() for origin in value.split(",") if origin.strip())


class BaseConfig:
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 15 * 1024 * 1024))
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")


class DevelopmentConfig(BaseConfig):
    APP_ENV = "development"
    DEBUG = True
    SECRET_KEY = os.getenv("SECRET_KEY") or secrets.token_urlsafe(32)
    SQLALCHEMY_DATABASE_URI = _database_url("yingmo_dev.db")
    CORS_ORIGINS = _cors_origins("http://localhost:5173,http://127.0.0.1:5173")


class TestingConfig(BaseConfig):
    APP_ENV = "testing"
    TESTING = True
    SECRET_KEY = secrets.token_urlsafe(32)
    SQLALCHEMY_DATABASE_URI = "sqlite://"
    CORS_ORIGINS = _cors_origins("http://localhost:5173,http://127.0.0.1:5173")


class ProductionConfig(BaseConfig):
    APP_ENV = "production"
    DEBUG = False
    SECRET_KEY = os.getenv("SECRET_KEY")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    CORS_ORIGINS = _cors_origins("")

    @classmethod
    def validate(cls):
        missing = [
            name
            for name, value in {
                "SECRET_KEY": cls.SECRET_KEY,
                "JWT_SECRET_KEY": cls.JWT_SECRET_KEY,
                "DATABASE_URL": cls.SQLALCHEMY_DATABASE_URI,
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
