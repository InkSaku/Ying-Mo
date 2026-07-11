import logging
import os
import uuid

from dotenv import load_dotenv
from flask import Flask, g, request

from .blueprints import register_blueprints
from .common.errors import register_error_handlers
from .config import INSTANCE_PATH, get_config
from .extensions import init_extensions


def create_app(config_name=None, config_overrides=None):
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
    environment = config_name or os.getenv("APP_ENV", "development")
    config_class = get_config(environment)

    if environment == "production":
        config_class.validate()

    app = Flask(__name__, instance_path=str(INSTANCE_PATH), instance_relative_config=True)
    app.config.from_object(config_class)
    if config_overrides:
        app.config.update(config_overrides)

    os.makedirs(app.instance_path, exist_ok=True)
    _configure_logging(app)
    _register_request_id(app)
    init_extensions(app)
    register_blueprints(app)
    register_error_handlers(app)
    app.logger.info("Yingmo backend initialized in %s environment", app.config["APP_ENV"])

    return app


def _register_request_id(app):
    @app.before_request
    def assign_request_id():
        provided_id = request.headers.get("X-Request-ID", "")
        g.request_id = provided_id[:128] if provided_id.isascii() and provided_id else uuid.uuid4().hex

    @app.after_request
    def attach_request_id(response):
        response.headers["X-Request-ID"] = g.request_id
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
