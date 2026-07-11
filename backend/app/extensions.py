from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()
migrate = Migrate()
cors = CORS()


def init_extensions(app):
    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(
        app,
        resources={
            r"/api/*": {
                "origins": list(app.config["CORS_ORIGINS"]),
                "allow_headers": ["Content-Type", "Authorization", "X-Request-ID"],
                "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            }
        },
        supports_credentials=True,
    )
