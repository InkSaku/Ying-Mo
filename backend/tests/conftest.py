import pytest

from app import create_app
from app.extensions import db


@pytest.fixture()
def app():
    application = create_app(
        "testing",
        {
            "CORS_ORIGINS": (
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            )
        },
    )
    with application.app_context():
        yield application
        db.session.remove()
        db.engine.dispose()


@pytest.fixture()
def client(app):
    return app.test_client()
