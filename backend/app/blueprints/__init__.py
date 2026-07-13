from .health import health_bp
from app.auth import auth_bp
from app.uploads import uploads_bp
from app.users import users_bp
from app.life import life_bp
from app.games import games_bp
from app.guides import guides_bp
from app.interactions import interactions_bp
from app.comments import comments_bp
from app.notifications import notifications_bp
from app.drafts import drafts_bp
from app.search import search_bp
from app.discovery import discovery_bp
from app.reports import reports_bp
from app.admin import admin_bp


def register_blueprints(app):
    app.register_blueprint(health_bp, url_prefix="/api/v1")
    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
    app.register_blueprint(uploads_bp, url_prefix="/api/v1/uploads")
    app.register_blueprint(users_bp, url_prefix="/api/v1/users")
    app.register_blueprint(life_bp, url_prefix="/api/v1/life")
    app.register_blueprint(games_bp, url_prefix="/api/v1/games")
    app.register_blueprint(guides_bp, url_prefix="/api/v1/guides")
    app.register_blueprint(interactions_bp, url_prefix="/api/v1/interactions")
    app.register_blueprint(comments_bp, url_prefix="/api/v1/comments")
    app.register_blueprint(notifications_bp, url_prefix="/api/v1/notifications")
    app.register_blueprint(drafts_bp, url_prefix="/api/v1/drafts")
    app.register_blueprint(search_bp, url_prefix="/api/v1/search")
    app.register_blueprint(discovery_bp, url_prefix="/api/v1/discover")
    app.register_blueprint(reports_bp, url_prefix="/api/v1/reports")
    app.register_blueprint(admin_bp, url_prefix="/api/v1/admin")
