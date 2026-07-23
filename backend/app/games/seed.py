"""Idempotent, administrator-owned Overwatch catalog importer."""
import json
from pathlib import Path

import click
from sqlalchemy import func, or_

from app.extensions import db
from app.models import Game, GameHero, GameMap, User
from .service import normalize_name, search_text, slug_for

DEFAULT_CATALOG = Path(__file__).resolve().parents[2] / "data" / "overwatch_catalog.json"

def _upsert(model, game, item, creator_id, kind):
    normalized_name = normalize_name(item["name_zh"])
    identity = [model.normalized_name == normalized_name]
    if item.get("slug"):
        identity.append(model.slug == item["slug"])
    current = db.session.scalar(
        db.select(model).where(model.game_id == game.id, or_(*identity))
    )
    values = {"name_zh": item["name_zh"], "name_en": item.get("name_en"), "aliases": item.get("aliases", []), "normalized_name": normalized_name, "search_text": search_text(item["name_zh"], item.get("name_en"), item.get("aliases", [])), "slug": item.get("slug") or (current.slug if current else slug_for(item["name_zh"])), "description": item.get("description")}
    if kind == "hero": values.update({"role": item.get("role"), "status": item.get("status", "active"), "review_status": "approved"})
    else: values.update({"map_type": item.get("map_type"), "current_status": item.get("current_status", "active"), "review_status": "approved"})
    if current:
        for key, value in values.items(): setattr(current, key, value)
    else: db.session.add(model(game_id=game.id, created_by_id=creator_id, **values))

def import_catalog(path, admin_username):
    data = json.loads(Path(path).read_text(encoding="utf-8")); admin = db.session.scalar(db.select(User).where(User.username == admin_username))
    if not admin: raise click.ClickException("未找到目录维护管理员。")
    info = data["game"]
    normalized_name = normalize_name(info["name_zh"])
    identity = [Game.normalized_name == normalized_name]
    if info.get("slug"):
        identity.append(Game.slug == info["slug"])
    game = db.session.scalar(db.select(Game).where(or_(*identity)))
    existing = game is not None
    if not game:
        game = Game(created_by_id=admin.id)
        db.session.add(game)
    game.name_zh = info["name_zh"]
    game.name_en = info.get("name_en")
    game.aliases = info.get("aliases", [])
    game.normalized_name = normalized_name
    game.search_text = search_text(info["name_zh"], info.get("name_en"), info.get("aliases", []))
    game.slug = info.get("slug") or (game.slug if existing else slug_for(info["name_zh"]))
    game.description = info.get("description")
    game.current_version = info.get("current_version")
    if not existing:
        game.status = "inactive"
    db.session.flush()
    try:
        for item in data.get("heroes", []): _upsert(GameHero, game, item, admin.id, "hero")
        for item in data.get("maps", []): _upsert(GameMap, game, item, admin.id, "map")
        db.session.flush()
        desired_status = info.get("status", game.status)
        if desired_status not in {"active", "inactive"}:
            raise click.ClickException("游戏状态必须是 active 或 inactive。")
        if desired_status == "active":
            active_heroes = db.session.scalar(db.select(func.count(GameHero.id)).where(GameHero.game_id == game.id, GameHero.status == "active", GameHero.review_status == "approved")) or 0
            usable_maps = db.session.scalar(db.select(func.count(GameMap.id)).where(GameMap.game_id == game.id, GameMap.review_status == "approved", GameMap.current_status != "retired")) or 0
            if not usable_maps or not active_heroes:
                raise click.ClickException("启用游戏前必须至少导入一张可用地图和一位可用英雄。")
        game.status = desired_status
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return game

def register_seed_command(app):
    @app.cli.command("import-overwatch-catalog")
    @click.option("--path", type=click.Path(exists=True, dir_okay=False), default=str(DEFAULT_CATALOG), show_default=True)
    @click.option("--admin", "admin_username", required=True)
    def command(path, admin_username):
        """Import catalog JSON without deleting historical catalog records."""
        game = import_catalog(path, admin_username); click.echo(f"Imported {game.name_zh} catalog.")
