from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
import os

from flask import Blueprint, current_app

from app.common.responses import error_response, success_response
from app.extensions import db


health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health_check():
    """Liveness probe: deliberately independent from database availability."""
    response, status_code = success_response({"status": "ok", "service": "yingmo-backend"})
    response.headers["Cache-Control"] = "no-store"
    return response, status_code


@health_bp.get("/health/ready")
def readiness_check():
    """Readiness probe: confirms dependencies needed to serve application traffic."""
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

    upload_root = current_app.config["UPLOAD_ROOT"]
    if not upload_root.is_dir() or not os.access(upload_root, os.W_OK):
        current_app.logger.warning("Readiness check upload storage unavailable")
        response, status_code = error_response("DEPENDENCY_UNAVAILABLE", "服务依赖暂时不可用。", 503)
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
