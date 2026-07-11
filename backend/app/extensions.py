from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager


db = SQLAlchemy()
migrate = Migrate()
cors = CORS()
jwt = JWTManager()


def init_extensions(app):
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(
        app,
        resources={
            r"/api/*": {
                "origins": list(app.config["CORS_ORIGINS"]),
                "allow_headers": ["Content-Type", "Authorization", "X-Request-ID", "X-CSRF-TOKEN"],
                "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            }
        },
        supports_credentials=True,
    )
    _register_jwt_error_handlers(jwt)


def _register_jwt_error_handlers(jwt_manager):
    from .common.responses import error_response

    def response(code, message, status):
        return error_response(code, message, status)

    @jwt_manager.unauthorized_loader
    def missing_token(_reason):
        return response("AUTHENTICATION_REQUIRED", "请先登录后再继续。", 401)

    @jwt_manager.invalid_token_loader
    def invalid_token(_reason):
        return response("TOKEN_INVALID", "登录状态无效，请重新登录。", 401)

    @jwt_manager.expired_token_loader
    def expired_token(_header, _payload):
        return response("TOKEN_EXPIRED", "登录状态已过期。", 401)

    @jwt_manager.revoked_token_loader
    def revoked_token(_header, _payload):
        return response("TOKEN_REVOKED", "当前会话已失效。", 401)

    @jwt_manager.needs_fresh_token_loader
    def needs_fresh(_header, _payload):
        return response("AUTHENTICATION_REQUIRED", "需要重新登录后再继续。", 401)

    @jwt_manager.user_lookup_error_loader
    def missing_user(_header, _payload):
        return response("ACCOUNT_RESTRICTED", "当前账号无法继续使用。", 403)
