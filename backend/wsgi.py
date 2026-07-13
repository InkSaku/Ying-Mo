import os

from app import create_app


if os.getenv("APP_ENV") != "production":
    raise RuntimeError("The production entry point requires APP_ENV=production.")

app = create_app("production")
