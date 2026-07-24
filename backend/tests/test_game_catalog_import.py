import json
from pathlib import Path
import uuid

import click
import pytest

from app.extensions import db
from app.games.seed import import_catalog
from app.models import Game, GameHero, GameMap, User


LOCAL_CATALOG = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "overwatch_catalog.local.json"
)


def catalog_data(marker, *, include_extra_hero=False):
    heroes = [
        {
            "name_zh": f"英雄{marker}",
            "name_en": f"Hero {marker}",
            "slug": f"hero-{marker}",
            "aliases": [f"H{marker}"],
            "role": "support",
            "status": "active",
        }
    ]
    if include_extra_hero:
        heroes.append(
            {
                "name_zh": f"历史英雄{marker}",
                "name_en": f"Legacy Hero {marker}",
                "slug": f"legacy-hero-{marker}",
                "aliases": [],
                "role": "damage",
                "status": "active",
            }
        )
    return {
        "game": {
            "name_zh": f"导入游戏{marker}",
            "name_en": f"Import Game {marker}",
            "slug": f"import-game-{marker}",
            "aliases": [f"IG{marker}"],
            "description": "首次导入",
            "current_version": "1.0",
            "status": "active",
        },
        "heroes": heroes,
        "maps": [
            {
                "name_zh": f"地图{marker}",
                "name_en": f"Map {marker}",
                "slug": f"map-{marker}",
                "aliases": [f"M{marker}"],
                "map_type": "hybrid",
                "current_status": "active",
            }
        ],
    }


def write_catalog(tmp_path, data):
    path = tmp_path / "catalog.json"
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return path


@pytest.fixture()
def import_case(app):
    marker = uuid.uuid4().hex[:8]
    with app.app_context():
        admin = User(
            username=f"i{marker}",
            username_normalized=f"i{marker}",
            email=f"i{marker}@example.test",
            email_normalized=f"i{marker}@example.test",
            password_hash="unused",
            nickname="导入管理员",
            role="content_admin",
        )
        db.session.add(admin)
        db.session.commit()
        case = {"marker": marker, "admin_id": admin.id, "username": admin.username}

    yield case

    with app.app_context():
        game_ids = list(
            db.session.scalars(
                db.select(Game.id).where(Game.created_by_id == case["admin_id"])
            )
        )
        if game_ids:
            db.session.execute(
                db.delete(GameHero).where(GameHero.game_id.in_(game_ids))
            )
            db.session.execute(
                db.delete(GameMap).where(GameMap.game_id.in_(game_ids))
            )
            db.session.execute(db.delete(Game).where(Game.id.in_(game_ids)))
        db.session.execute(db.delete(User).where(User.id == case["admin_id"]))
        db.session.commit()


def test_first_catalog_import_creates_an_active_ready_directory(
    tmp_path, import_case
):
    data = catalog_data(import_case["marker"])
    game = import_catalog(write_catalog(tmp_path, data), import_case["username"])

    assert game.status == "active"
    assert db.session.scalar(
        db.select(db.func.count(GameHero.id)).where(GameHero.game_id == game.id)
    ) == 1
    assert db.session.scalar(
        db.select(db.func.count(GameMap.id)).where(GameMap.game_id == game.id)
    ) == 1


def test_second_catalog_import_does_not_create_duplicates(tmp_path, import_case):
    path = write_catalog(tmp_path, catalog_data(import_case["marker"]))

    first = import_catalog(path, import_case["username"])
    second = import_catalog(path, import_case["username"])

    assert first.id == second.id
    assert db.session.scalar(
        db.select(db.func.count(Game.id)).where(
            Game.slug == f"import-game-{import_case['marker']}"
        )
    ) == 1
    assert db.session.scalar(
        db.select(db.func.count(GameHero.id)).where(GameHero.game_id == first.id)
    ) == 1
    assert db.session.scalar(
        db.select(db.func.count(GameMap.id)).where(GameMap.game_id == first.id)
    ) == 1


def test_catalog_import_updates_existing_records_by_stable_slug(
    tmp_path, import_case
):
    data = catalog_data(import_case["marker"])
    path = write_catalog(tmp_path, data)
    game = import_catalog(path, import_case["username"])
    hero_id = db.session.scalar(
        db.select(GameHero.id).where(GameHero.game_id == game.id)
    )
    map_id = db.session.scalar(
        db.select(GameMap.id).where(GameMap.game_id == game.id)
    )

    data["game"]["name_zh"] = f"更新游戏{import_case['marker']}"
    data["game"]["description"] = "修改后的目录说明"
    data["game"]["current_version"] = "2.0"
    data["heroes"][0]["name_zh"] = f"更新英雄{import_case['marker']}"
    data["heroes"][0]["role"] = "damage"
    data["maps"][0]["name_zh"] = f"更新地图{import_case['marker']}"
    data["maps"][0]["map_type"] = "escort"
    updated = import_catalog(write_catalog(tmp_path, data), import_case["username"])

    assert updated.id == game.id
    assert updated.description == "修改后的目录说明"
    assert updated.current_version == "2.0"
    hero = db.session.get(GameHero, hero_id)
    game_map = db.session.get(GameMap, map_id)
    assert hero.name_zh == f"更新英雄{import_case['marker']}"
    assert hero.role == "damage"
    assert game_map.name_zh == f"更新地图{import_case['marker']}"
    assert game_map.map_type == "escort"


def test_catalog_import_never_deletes_records_missing_from_json(
    tmp_path, import_case
):
    data = catalog_data(import_case["marker"], include_extra_hero=True)
    game = import_catalog(write_catalog(tmp_path, data), import_case["username"])
    assert db.session.scalar(
        db.select(db.func.count(GameHero.id)).where(GameHero.game_id == game.id)
    ) == 2

    data["heroes"] = data["heroes"][:1]
    import_catalog(write_catalog(tmp_path, data), import_case["username"])

    assert db.session.scalar(
        db.select(db.func.count(GameHero.id)).where(GameHero.game_id == game.id)
    ) == 2
    assert db.session.scalar(
        db.select(db.func.count(GameHero.id)).where(
            GameHero.game_id == game.id,
            GameHero.slug == f"legacy-hero-{import_case['marker']}",
        )
    ) == 1


def test_catalog_import_reports_a_missing_admin(tmp_path, import_case):
    path = write_catalog(tmp_path, catalog_data(import_case["marker"]))

    with pytest.raises(click.ClickException, match="未找到目录维护管理员"):
        import_catalog(path, "missing-admin")


def test_local_catalog_is_explicitly_limited_and_contains_prd_examples():
    data = json.loads(LOCAL_CATALOG.read_text(encoding="utf-8"))

    assert data["source"]["purpose"] == "local_development_only"
    assert "不是完整或正式" in data["source"]["note"]
    assert data["game"]["status"] == "active"
    assert {item["name_zh"] for item in data["maps"]} == {
        "国王大道",
        "监测站：直布罗陀",
        "漓江塔",
    }
    assert {item["name_zh"] for item in data["heroes"]} == {
        "安娜",
        "托比昂",
        "黑百合",
        "温斯顿",
        "秩序之光",
        "狂鼠",
    }
    assert all(item["current_status"] == "active" for item in data["maps"])
    assert all(item["status"] == "active" for item in data["heroes"])
