from __future__ import annotations

from flask import Flask

from constants import DB_PATH
from db import close_db, ensure_schema
from models import db
from routes import register_routes


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DB_PATH}"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)
    ensure_schema()
    app.teardown_appcontext(close_db)
    register_routes(app)
    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True, use_reloader=True)
