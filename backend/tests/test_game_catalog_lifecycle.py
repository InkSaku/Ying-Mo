from types import SimpleNamespace
import uuid

import pytest
from flask_jwt_extended import create_access_token

from app.extensions import db
from app.models import AdminLog, Game, GameGuide, GameHero, GameMap, User


def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def catalog_case(app):
    marker = uuid.uuid4().hex[:8]
    with app.app_context():
        admin = User(
            username=f"a{marker}",
            username_normalized=f"a{marker}",
            email=f"a{marker}@example.test",
            email_normalized=f"a{marker}@example.test",
            password_hash="unused",
            nickname="目录管理员",
            role="content_admin",
        )
        member = User(
            username=f"u{marker}",
            username_normalized=f"u{marker}",
            email=f"u{marker}@example.test",
            email_normalized=f"u{marker}@example.test",
            password_hash="unused",
            nickname="普通用户",
        )
        db.session.add_all([admin, member])
        db.session.commit()
        context = SimpleNamespace(
            marker=marker,
            admin_id=admin.id,
            member_id=member.id,
            admin_token=create_access_token(identity=str(admin.id)),
            member_token=create_access_token(identity=str(member.id)),
        )

    yield context

    with app.app_context():
        game_ids = list(
            db.session.scalars(
                db.select(Game.id).where(Game.created_by_id == context.admin_id)
            )
        )
        if game_ids:
            db.session.execute(
                db.delete(GameGuide).where(GameGuide.game_id.in_(game_ids))
            )
            db.session.execute(
                db.delete(GameHero).where(GameHero.game_id.in_(game_ids))
            )
            db.session.execute(
                db.delete(GameMap).where(GameMap.game_id.in_(game_ids))
            )
            db.session.execute(db.delete(Game).where(Game.id.in_(game_ids)))
        db.session.execute(
            db.delete(AdminLog).where(AdminLog.admin_id == context.admin_id)
        )
        db.session.execute(
            db.delete(User).where(
                User.id.in_((context.admin_id, context.member_id))
            )
        )
        db.session.commit()


def create_game(client, case, suffix="", **overrides):
    payload = {
        "name_zh": f"测试游戏{case.marker}{suffix}",
        "name_en": f"Test Game {case.marker}{suffix}",
        "aliases": [f"TG{case.marker}{suffix}"],
    }
    payload.update(overrides)
    return client.post("/api/v1/games", json=payload, headers=auth(case.admin_token))


def add_usable_map_and_hero(app, case, game_id):
    game_map = GameMap(
        game_id=game_id,
        name_zh=f"地图{case.marker}",
        normalized_name=f"map{case.marker}",
        search_text=f"地图{case.marker}",
        slug=f"map-{case.marker}",
        aliases=[],
        current_status="active",
        review_status="approved",
        created_by_id=case.admin_id,
    )
    hero = GameHero(
        game_id=game_id,
        name_zh=f"英雄{case.marker}",
        normalized_name=f"hero{case.marker}",
        search_text=f"英雄{case.marker}",
        slug=f"hero-{case.marker}",
        aliases=[],
        status="active",
        review_status="approved",
        created_by_id=case.admin_id,
    )
    db.session.add_all([game_map, hero])
    db.session.commit()
    return game_map.id, hero.id


def test_admin_created_game_defaults_to_inactive(client, catalog_case):
    response = create_game(
        client,
        catalog_case,
        description="目录准备说明",
        current_version="1.0",
    )

    assert response.status_code == 201
    data = response.json["data"]
    assert data["status"] == "inactive"
    assert data["catalog_ready"] is False
    assert data["active_hero_count"] == 0
    assert data["usable_map_count"] == 0
    assert data["guide_count"] == 0
    assert data["catalog_issues"] == [
        "请先创建至少一张可用地图。",
        "请先创建至少一位可用英雄。",
    ]


@pytest.mark.parametrize("headers, expected", [(None, 401), ("member", 403)])
def test_only_admin_can_create_games(client, catalog_case, headers, expected):
    request_headers = (
        auth(catalog_case.member_token) if headers == "member" else None
    )
    response = client.post(
        "/api/v1/games",
        json={"name_zh": f"无权创建{catalog_case.marker}{expected}"},
        headers=request_headers,
    )

    assert response.status_code == expected


def test_game_activation_requires_usable_map_and_active_hero(
    app, client, catalog_case
):
    game_id = create_game(client, catalog_case).json["data"]["id"]

    no_catalog = client.patch(
        f"/api/v1/games/{game_id}",
        json={"status": "active"},
        headers=auth(catalog_case.admin_token),
    )
    assert no_catalog.status_code == 422
    assert {item["field"] for item in no_catalog.json["error"]["details"]} == {
        "maps",
        "heroes",
    }

    db.session.add(
        GameMap(
            game_id=game_id,
            name_zh=f"地图{catalog_case.marker}",
            normalized_name=f"map{catalog_case.marker}",
            search_text=f"地图{catalog_case.marker}",
            slug=f"map-{catalog_case.marker}",
            aliases=[],
            current_status="active",
            review_status="approved",
            created_by_id=catalog_case.admin_id,
        )
    )
    db.session.commit()

    no_hero = client.patch(
        f"/api/v1/games/{game_id}",
        json={"status": "active"},
        headers=auth(catalog_case.admin_token),
    )
    assert no_hero.status_code == 422
    assert [item["field"] for item in no_hero.json["error"]["details"]] == [
        "heroes"
    ]

    db.session.add(
        GameHero(
            game_id=game_id,
            name_zh=f"英雄{catalog_case.marker}",
            normalized_name=f"hero{catalog_case.marker}",
            search_text=f"英雄{catalog_case.marker}",
            slug=f"hero-{catalog_case.marker}",
            aliases=[],
            status="active",
            review_status="approved",
            created_by_id=catalog_case.admin_id,
        )
    )
    db.session.commit()

    activated = client.patch(
        f"/api/v1/games/{game_id}",
        json={"status": "active"},
        headers=auth(catalog_case.admin_token),
    )
    assert activated.status_code == 200
    assert activated.json["data"]["status"] == "active"
    assert activated.json["data"]["catalog_ready"] is True


def test_admin_listing_includes_both_statuses_and_supports_filtering(
    app, client, catalog_case
):
    inactive = create_game(client, catalog_case, "inactive").json["data"]
    active = create_game(client, catalog_case, "active").json["data"]
    add_usable_map_and_hero(app, catalog_case, active["id"])
    activated = client.patch(
        f"/api/v1/games/{active['id']}",
        json={"status": "active"},
        headers=auth(catalog_case.admin_token),
    )
    assert activated.status_code == 200

    public = client.get("/api/v1/games", query_string={"page_size": 100})
    public_ids = {item["id"] for item in public.json["data"]}
    assert active["id"] in public_ids
    assert inactive["id"] not in public_ids

    admin_all = client.get(
        "/api/v1/admin/catalog/games",
        query_string={"page_size": 100},
        headers=auth(catalog_case.admin_token),
    )
    admin_ids = {item["id"] for item in admin_all.json["data"]}
    assert {active["id"], inactive["id"]}.issubset(admin_ids)

    admin_inactive = client.get(
        "/api/v1/admin/catalog/games",
        query_string={"status": "inactive", "page_size": 100},
        headers=auth(catalog_case.admin_token),
    )
    filtered_ids = {item["id"] for item in admin_inactive.json["data"]}
    assert inactive["id"] in filtered_ids
    assert active["id"] not in filtered_ids


def test_game_response_counts_published_points(
    app, client, catalog_case
):
    game = create_game(client, catalog_case).json["data"]
    map_id, hero_id = add_usable_map_and_hero(app, catalog_case, game["id"])
    db.session.add(
        GameGuide(
            author_id=catalog_case.member_id,
            game_id=game["id"],
            map_id=map_id,
            hero_id=hero_id,
            guide_scope="hero_map",
            title="已发布点位",
            category="other",
            instructions="测试说明",
            tags=[],
            search_text="已发布点位 测试说明",
            status="published",
        )
    )
    db.session.commit()

    response = client.get(
        "/api/v1/admin/catalog/games",
        query_string={"game_id": game["id"]},
        headers=auth(catalog_case.admin_token),
    )

    assert response.status_code == 200
    data = response.json["data"][0]
    assert data["active_hero_count"] == 1
    assert data["usable_map_count"] == 1
    assert data["guide_count"] == 1
    assert data["catalog_ready"] is True


def test_name_and_alias_conflicts_remain_blocked(client, catalog_case):
    first = create_game(
        client,
        catalog_case,
        name_zh=f"冲突游戏{catalog_case.marker}",
        aliases=[f"唯一别名{catalog_case.marker}"],
    )
    assert first.status_code == 201

    same_name = create_game(
        client,
        catalog_case,
        "name",
        name_zh=f"冲突游戏{catalog_case.marker}",
        aliases=[],
    )
    alias_as_name = create_game(
        client,
        catalog_case,
        "alias",
        name_zh=f"唯一别名{catalog_case.marker}",
        aliases=[],
    )

    assert same_name.status_code == 409
    assert alias_as_name.status_code == 409


def test_deactivation_keeps_historical_points_accessible(
    app, client, catalog_case
):
    game = create_game(client, catalog_case).json["data"]
    map_id, hero_id = add_usable_map_and_hero(app, catalog_case, game["id"])
    activated = client.patch(
        f"/api/v1/games/{game['id']}",
        json={"status": "active"},
        headers=auth(catalog_case.admin_token),
    )
    assert activated.status_code == 200

    guide = GameGuide(
        author_id=catalog_case.member_id,
        game_id=game["id"],
        map_id=map_id,
        hero_id=hero_id,
        guide_scope="hero_map",
        title="历史点位",
        category="other",
        instructions="停用目录后仍需保留",
        tags=[],
        search_text="历史点位",
        status="published",
    )
    db.session.add(guide)
    db.session.commit()
    guide_id = guide.id

    deactivated = client.patch(
        f"/api/v1/games/{game['id']}",
        json={"status": "inactive"},
        headers=auth(catalog_case.admin_token),
    )
    assert deactivated.status_code == 200

    assert db.session.get(GameGuide, guide_id) is not None
    assert db.session.get(GameMap, map_id) is not None
    assert db.session.get(GameHero, hero_id) is not None

    public = client.get("/api/v1/games", query_string={"page_size": 100})
    assert game["id"] not in {item["id"] for item in public.json["data"]}

    detail = client.get(f"/api/v1/guides/{guide_id}")
    assert detail.status_code == 200
    assert detail.json["data"]["game"]["status"] == "inactive"
    assert detail.json["data"]["game"]["is_available"] is False
    assert detail.json["data"]["map"]["is_available"] is False
    assert detail.json["data"]["hero"]["is_available"] is False
