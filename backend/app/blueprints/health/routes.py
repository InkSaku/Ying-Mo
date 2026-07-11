from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from flask import Blueprint, current_app

from app.common.responses import error_response, success_response
from app.extensions import db


health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health_check():
    try:
        db.session.execute(text("SELECT 1"))
    except SQLAlchemyError:
        current_app.logger.warning("Health check database query failed", exc_info=True)
        response, status_code = error_response(
            "DATABASE_UNAVAILABLE",
            "数据库暂时不可用。",
            503,
        )
        response.headers["Cache-Control"] = "no-store"
        return response, status_code

    response, status_code = success_response(
        {
            "status": "ok",
            "service": "yingmo-backend",
            "environment": current_app.config["APP_ENV"],
            "database": "connected",
        }
    )
    response.headers["Cache-Control"] = "no-store"
    return response, status_code
