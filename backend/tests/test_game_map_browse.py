import uuid

import pytest

from app.extensions import db
from app.models import Game, GameGuide, GameHero, GameMap, User


@pytest.fixture()
def browse_catalog(app):
    marker = uuid.uuid4().hex[:8]
    with app.app_context():
        owner = User(
            username=f"b{marker}",
            username_normalized=f"b{marker}",
            email=f"b{marker}@example.test",
            email_normalized=f"b{marker}@example.test",
            password_hash="unused",
            nickname="浏览测试",
            role="content_admin",
        )
        db.session.add(owner)
        db.session.flush()
        active_game = Game(
            name_zh=f"公开游戏{marker}",
            normalized_name=f"activegame{marker}",
            search_text=f"公开游戏{marker}",
            slug=f"active-game-{marker}",
            aliases=[],
            status="active",
            created_by_id=owner.id,
        )
        inactive_game = Game(
            name_zh=f"未启用游戏{marker}",
            normalized_name=f"inactivegame{marker}",
            search_text=f"未启用游戏{marker}",
            slug=f"inactive-game-{marker}",
            aliases=[],
            status="inactive",
            created_by_id=owner.id,
        )
        db.session.add_all([active_game, inactive_game])
        db.session.flush()
        hero = GameHero(
            game_id=active_game.id,
            name_zh=f"英雄{marker}",
            normalized_name=f"hero{marker}",
            search_text=f"英雄{marker}",
            slug=f"hero-{marker}",
            aliases=[],
            status="active",
            review_status="approved",
            created_by_id=owner.id,
        )
        active_map = GameMap(
            game_id=active_game.id,
            name_zh=f"Z 当前地图{marker}",
            normalized_name=f"activemap{marker}",
            search_text=f"当前地图{marker}",
            slug=f"active-map-{marker}",
            aliases=[],
            current_status="active",
            review_status="approved",
            created_by_id=owner.id,
        )
        rotated_map = GameMap(
            game_id=active_game.id,
            name_zh=f"A 轮换地图{marker}",
            normalized_name=f"rotatedmap{marker}",
            search_text=f"轮换地图{marker}",
            slug=f"rotated-map-{marker}",
            aliases=[],
            current_status="rotated_out",
            review_status="approved",
            created_by_id=owner.id,
        )
        retired_map = GameMap(
            game_id=active_game.id,
            name_zh=f"退役地图{marker}",
            normalized_name=f"retiredmap{marker}",
            search_text=f"退役地图{marker}",
            slug=f"retired-map-{marker}",
            aliases=[],
            current_status="retired",
            review_status="approved",
            created_by_id=owner.id,
        )
        db.session.add_all([hero, active_map, rotated_map, retired_map])
        db.session.flush()
        db.session.add_all([
            GameGuide(
                author_id=owner.id,
                game_id=active_game.id,
                map_id=active_map.id,
                hero_id=hero.id,
                guide_scope="hero_map",
                title="当前地图点位",
                category="other",
                instructions="测试",
                tags=[],
                search_text="测试",
                status="published",
            ),
            GameGuide(
                author_id=owner.id,
                game_id=active_game.id,
                map_id=retired_map.id,
                hero_id=hero.id,
                guide_scope="hero_map",
                title="历史地图点位",
                category="other",
                instructions="历史测试",
                tags=[],
                search_text="历史测试",
                status="published",
            ),
        ])
        db.session.commit()
        data = {
            "owner_id": owner.id,
            "game_ids": [active_game.id, inactive_game.id],
            "game_slug": active_game.slug,
            "inactive_slug": inactive_game.slug,
            "active_map_id": active_map.id,
            "active_map_slug": active_map.slug,
            "rotated_map_id": rotated_map.id,
            "retired_map_id": retired_map.id,
            "retired_map_slug": retired_map.slug,
            "hero_id": hero.id,
        }

    yield data

    with app.app_context():
        db.session.execute(
            db.delete(GameGuide).where(GameGuide.game_id.in_(data["game_ids"]))
        )
        db.session.execute(
            db.delete(GameHero).where(GameHero.game_id.in_(data["game_ids"]))
        )
        db.session.execute(
            db.delete(GameMap).where(GameMap.game_id.in_(data["game_ids"]))
        )
        db.session.execute(db.delete(Game).where(Game.id.in_(data["game_ids"])))
        db.session.execute(db.delete(User).where(User.id == data["owner_id"]))
        db.session.commit()


def test_game_routes_distinguish_missing_and_inactive_games(
    client, browse_catalog
):
    inactive = client.get(
        f"/api/v1/games/{browse_catalog['inactive_slug']}/maps"
    )
    missing = client.get("/api/v1/games/not-a-real-game/maps")

    assert inactive.status_code == 409
    assert inactive.json["error"]["code"] == "GAME_INACTIVE"
    assert missing.status_code == 404
    assert missing.json["error"]["code"] == "RESOURCE_NOT_FOUND"


def test_default_map_list_prioritizes_active_and_excludes_retired(
    client, browse_catalog
):
    response = client.get(
        f"/api/v1/games/{browse_catalog['game_slug']}/maps",
        query_string={"page_size": 100},
    )

    assert response.status_code == 200
    maps = response.json["data"]
    assert [item["id"] for item in maps] == [
        browse_catalog["active_map_id"],
        browse_catalog["rotated_map_id"],
    ]
    assert maps[0]["guide_count"] == 1
    assert maps[0]["hero_with_guides_count"] == 1
    assert maps[1]["current_status"] == "rotated_out"


def test_retired_map_remains_available_through_historical_links(
    client, browse_catalog
):
    detail = client.get(
        f"/api/v1/games/{browse_catalog['game_slug']}/maps/{browse_catalog['retired_map_slug']}"
    )
    heroes = client.get(
        f"/api/v1/games/{browse_catalog['game_slug']}/maps/{browse_catalog['retired_map_slug']}/heroes",
        query_string={"page_size": 100},
    )
    filtered = client.get(
        f"/api/v1/games/{browse_catalog['game_slug']}/maps",
        query_string={"current_status": "retired", "page_size": 100},
    )

    assert detail.status_code == 200
    assert detail.json["data"]["current_status"] == "retired"
    assert detail.json["data"]["is_available"] is False
    assert detail.json["data"]["guide_count"] == 1
    assert heroes.status_code == 200
    assert heroes.json["data"][0]["id"] == browse_catalog["hero_id"]
    assert heroes.json["data"][0]["guide_count"] == 1
    assert [item["id"] for item in filtered.json["data"]] == [
        browse_catalog["retired_map_id"]
    ]
