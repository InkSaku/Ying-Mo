import logging
import os
import re
import uuid
from time import perf_counter

from dotenv import load_dotenv
from flask import Flask, g, request
from flask_jwt_extended import get_jwt_identity

from .blueprints import register_blueprints
from .common.errors import register_error_handlers
from .config import get_config
from .extensions import init_extensions
from .maintenance import register_commands
from . import models  # noqa: F401


def create_app(config_name=None, config_overrides=None):
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
    environment = config_name or os.getenv("APP_ENV", "development")
    config_class = get_config(environment)

    app = Flask(__name__)
    app.config.from_object(config_class)
    if config_overrides:
        app.config.update(config_overrides)
    app.config["SQLALCHEMY_DATABASE_URI"] = config_class.database_uri()
    if environment == "production":
        config_class.validate(app.config)

    _configure_logging(app)
    _register_request_id(app)
    init_extensions(app)
    register_commands(app)
    register_blueprints(app)
    register_error_handlers(app)
    app.logger.info("Yingmo backend initialized in %s environment", app.config["APP_ENV"])

    return app


def _register_request_id(app):
    safe_request_id = re.compile(r"^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|[0-9A-HJKMNP-TV-Z]{26})$")

    @app.before_request
    def assign_request_id():
        provided_id = request.headers.get("X-Request-ID", "")
        g.request_id = provided_id if safe_request_id.fullmatch(provided_id) else str(uuid.uuid4())
        g.request_started_at = perf_counter()

    @app.after_request
    def attach_request_id(response):
        response.headers["X-Request-ID"] = g.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if app.config["APP_ENV"] == "production" and request.is_secure:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        duration_ms = round((perf_counter() - g.request_started_at) * 1000, 2)
        try:
            user_id = get_jwt_identity()
        except RuntimeError:
            user_id = None
        app.logger.info("request_id=%s method=%s path=%s status=%s duration_ms=%s user_id=%s", g.request_id, request.method, request.path, response.status_code, duration_ms, user_id or "-")
        return response


def _configure_logging(app):
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    if not app.logger.handlers:
        handler = logging.StreamHandler()
        handler.name = "yingmo-console"
        app.logger.addHandler(handler)

    for handler in app.logger.handlers:
        handler.setFormatter(formatter)
    app.logger.setLevel(logging.DEBUG if app.config.get("DEBUG") else logging.INFO)
