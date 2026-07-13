from flask import Blueprint

interactions_bp = Blueprint("interactions", __name__)
from . import routes  # noqa: E402,F401

