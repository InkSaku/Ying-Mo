import os

from app import create_app

app = create_app()


if __name__ == "__main__":
    host = os.getenv("FLASK_RUN_HOST", "127.0.0.1")
    if app.config["APP_ENV"] == "development" and host not in {"127.0.0.1", "localhost", "::1"} and os.getenv("ALLOW_INSECURE_DEV_SERVER") != "1":
        raise RuntimeError("Development server may only bind to loopback; set APP_ENV=production for deployment.")
    if app.config["APP_ENV"] == "production" and app.config.get("DEBUG"):
        raise RuntimeError("Debug cannot be enabled in production.")
    app.run(
        host=host,
        port=int(os.getenv("FLASK_RUN_PORT", "5000")),
        debug=False if app.config["APP_ENV"] == "production" else app.config["DEBUG"],
    )
