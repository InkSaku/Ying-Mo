"""Idempotent, administrator-owned Overwatch catalog importer."""
import json
from pathlib import Path

import click

from app.extensions import db
from app.models import Game, GameHero, GameMap, User
from .service import normalize_name, search_text, slug_for

DEFAULT_CATALOG = Path(__file__).resolve().parents[2] / "data" / "overwatch_catalog.json"

def _upsert(model, game, item, creator_id, kind):
    current = db.session.scalar(db.select(model).where(model.game_id == game.id, model.normalized_name == normalize_name(item["name_zh"])))
    values = {"name_zh": item["name_zh"], "name_en": item.get("name_en"), "aliases": item.get("aliases", []), "normalized_name": normalize_name(item["name_zh"]), "search_text": search_text(item["name_zh"], item.get("name_en"), item.get("aliases", [])), "slug": item.get("slug") or slug_for(item["name_zh"]), "description": item.get("description")}
    if kind == "hero": values.update({"role": item.get("role"), "status": item.get("status", "active"), "review_status": "approved"})
    else: values.update({"map_type": item.get("map_type"), "current_status": item.get("current_status", "active"), "review_status": "approved"})
    if current:
        for key, value in values.items(): setattr(current, key, value)
    else: db.session.add(model(game_id=game.id, created_by_id=creator_id, **values))

def import_catalog(path, admin_username):
    data = json.loads(Path(path).read_text(encoding="utf-8")); admin = db.session.scalar(db.select(User).where(User.username == admin_username))
    if not admin: raise click.ClickException("未找到目录维护管理员。")
    info = data["game"]; game = db.session.scalar(db.select(Game).where(Game.normalized_name == normalize_name(info["name_zh"])))
    if not game:
        game = Game(created_by_id=admin.id, name_zh=info["name_zh"], name_en=info.get("name_en"), aliases=info.get("aliases", []), normalized_name=normalize_name(info["name_zh"]), search_text=search_text(info["name_zh"], info.get("name_en"), info.get("aliases", [])), slug=info.get("slug") or slug_for(info["name_zh"]), description=info.get("description"), current_version=info.get("current_version"), status="active"); db.session.add(game); db.session.flush()
    for item in data.get("heroes", []): _upsert(GameHero, game, item, admin.id, "hero")
    for item in data.get("maps", []): _upsert(GameMap, game, item, admin.id, "map")
    db.session.commit(); return game

def register_seed_command(app):
    @app.cli.command("import-overwatch-catalog")
    @click.option("--path", type=click.Path(exists=True, dir_okay=False), default=str(DEFAULT_CATALOG), show_default=True)
    @click.option("--admin", "admin_username", required=True)
    def command(path, admin_username):
        """Import catalog JSON without deleting historical catalog records."""
        game = import_catalog(path, admin_username); click.echo(f"Imported {game.name_zh} catalog.")
