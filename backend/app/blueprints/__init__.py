from .health import health_bp
from app.auth import auth_bp
from app.uploads import uploads_bp
from app.users import users_bp


def register_blueprints(app):
    app.register_blueprint(health_bp, url_prefix="/api/v1")
    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
    app.register_blueprint(uploads_bp, url_prefix="/api/v1/uploads")
    app.register_blueprint(users_bp, url_prefix="/api/v1/users")
