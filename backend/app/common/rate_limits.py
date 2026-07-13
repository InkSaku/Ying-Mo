import hashlib

from flask import request
from flask_jwt_extended import get_jwt, get_jwt_identity

from app.extensions import limiter


def _digest(value):
    return hashlib.sha256((value or "").strip().casefold().encode("utf-8")).hexdigest()[:20]


def client_ip():
    return request.remote_addr or "unknown"


def login_key():
    payload = request.get_json(silent=True) or {}
    return f"{client_ip()}:{_digest(payload.get('identifier') if isinstance(payload.get('identifier'), str) else '')}"


def refresh_key():
    try:
        session = get_jwt().get("jti", "")
    except RuntimeError:
        session = ""
    return f"{client_ip()}:{_digest(session)}"


def user_key():
    try:
        identity = get_jwt_identity()
    except RuntimeError:
        identity = None
    return f"user:{identity}" if identity else f"ip:{client_ip()}"
