from datetime import timedelta
import uuid

import pytest

from app.auth.service import utcnow
from app.extensions import db
from app.models import ContentFavorite, ContentLike, Game, GameGuide, GameHero, GameMap, User


@pytest.fixture()
def guide_browse_context(app):
    marker = uuid.uuid4().hex[:8]
    with app.app_context():
        author = User(
            username=f"l{marker}",
            username_normalized=f"l{marker}",
            email=f"l{marker}@example.test",
            email_normalized=f"l{marker}@example.test",
            password_hash="unused",
            nickname="点位作者",
        )
        viewer = User(
            username=f"v{marker}",
            username_normalized=f"v{marker}",
            email=f"v{marker}@example.test",
            email_normalized=f"v{marker}@example.test",
            password_hash="unused",
            nickname="浏览者",
        )
        db.session.add_all([author, viewer])
        db.session.flush()
        game = Game(name_zh=f"浏览游戏{marker}", normalized_name=f"browse{marker}", search_text=f"浏览游戏{marker}", slug=f"browse-{marker}", aliases=[], status="active", created_by_id=author.id)
        db.session.add(game)
        db.session.flush()
        hero = GameHero(game_id=game.id, name_zh=f"英雄{marker}", normalized_name=f"hero{marker}", search_text=f"英雄{marker}", slug=f"hero-{marker}", aliases=[], status="active", review_status="approved", created_by_id=author.id)
        game_map = GameMap(game_id=game.id, name_zh=f"地图{marker}", normalized_name=f"map{marker}", search_text=f"地图{marker}", slug=f"map-{marker}", aliases=[], current_status="active", review_status="approved", created_by_id=author.id)
        db.session.add_all([hero, game_map])
        db.session.flush()
        now = utcnow()
        valid = GameGuide(
            author_id=author.id,
            game_id=game.id,
            map_id=game_map.id,
            hero_id=hero.id,
            guide_scope="hero_map",
            title="当前有效点位",
            category="skill_throw",
            instructions="有效说明",
            map_area="A 区",
            side="attack",
            tags=[],
            search_text="有效说明",
            validity_status="valid",
            status="published",
            created_at=now - timedelta(days=2),
            updated_at=now - timedelta(days=2),
        )
        invalid = GameGuide(
            author_id=author.id,
            game_id=game.id,
            map_id=game_map.id,
            hero_id=hero.id,
            guide_scope="hero_map",
            title="已失效但更新较新",
            category="skill_throw",
            instructions="失效说明",
            tags=[],
            search_text="失效说明",
            validity_status="invalid",
            status="published",
            created_at=now,
            updated_at=now,
        )
        db.session.add_all([valid, invalid])
        db.session.flush()
        db.session.add_all([
            ContentLike(user_id=viewer.id, target_type="game_guide", target_id=valid.id),
            ContentFavorite(user_id=viewer.id, target_type="game_guide", target_id=valid.id),
        ])
        db.session.commit()
        context = {
            "user_ids": [author.id, viewer.id],
            "game_id": game.id,
            "hero_id": hero.id,
            "map_id": game_map.id,
            "game_slug": game.slug,
            "hero_slug": hero.slug,
            "map_slug": game_map.slug,
            "guide_ids": [valid.id, invalid.id],
        }

    yield context

    with app.app_context():
        db.session.execute(db.delete(ContentLike).where(ContentLike.target_type == "game_guide", ContentLike.target_id.in_(context["guide_ids"])))
        db.session.execute(db.delete(ContentFavorite).where(ContentFavorite.target_type == "game_guide", ContentFavorite.target_id.in_(context["guide_ids"])))
        db.session.execute(db.delete(GameGuide).where(GameGuide.id.in_(context["guide_ids"])))
        db.session.execute(db.delete(GameHero).where(GameHero.id == context["hero_id"]))
        db.session.execute(db.delete(GameMap).where(GameMap.id == context["map_id"]))
        db.session.execute(db.delete(Game).where(Game.id == context["game_id"]))
        db.session.execute(db.delete(User).where(User.id.in_(context["user_ids"])))
        db.session.commit()


def test_combination_default_sort_keeps_invalid_guides_after_valid_guides(client, guide_browse_context):
    response = client.get(
        "/api/v1/guides",
        query_string={
            "game_slug": guide_browse_context["game_slug"],
            "map_slug": guide_browse_context["map_slug"],
            "hero_slug": guide_browse_context["hero_slug"],
            "sort": "updated",
        },
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.json["data"]] == guide_browse_context["guide_ids"]
    assert response.json["data"][0]["like_count"] == 1
    assert response.json["data"][0]["favorite_count"] == 1
    assert response.json["data"][1]["validity_status"] == "invalid"


def test_guide_detail_includes_interaction_counts_and_catalog_availability(client, guide_browse_context):
    response = client.get(f"/api/v1/guides/{guide_browse_context['guide_ids'][0]}")

    assert response.status_code == 200
    data = response.json["data"]
    assert data["like_count"] == 1
    assert data["favorite_count"] == 1
    assert data["game"]["is_available"] is True
    assert data["map"]["is_available"] is True
    assert data["hero"]["is_available"] is True


def test_historical_combination_remains_reachable_after_catalog_deactivation(client, guide_browse_context):
    with client.application.app_context():
        db.session.get(Game, guide_browse_context["game_id"]).status = "inactive"
        db.session.get(GameHero, guide_browse_context["hero_id"]).status = "inactive"
        db.session.commit()

    combination = client.get(
        "/api/v1/guides",
        query_string={
            "game_slug": guide_browse_context["game_slug"],
            "map_slug": guide_browse_context["map_slug"],
            "hero_slug": guide_browse_context["hero_slug"],
        },
    )
    game_map = client.get(f"/api/v1/games/{guide_browse_context['game_slug']}/maps/{guide_browse_context['map_slug']}")
    hero = client.get(f"/api/v1/games/{guide_browse_context['game_slug']}/heroes/{guide_browse_context['hero_slug']}")
    directory = client.get(f"/api/v1/games/{guide_browse_context['game_slug']}/maps")

    assert combination.status_code == 200
    assert {item["id"] for item in combination.json["data"]} == set(guide_browse_context["guide_ids"])
    assert game_map.status_code == 200
    assert game_map.json["data"]["is_available"] is False
    assert hero.status_code == 200
    assert hero.json["data"]["is_available"] is False
    assert directory.status_code == 409
    assert directory.json["error"]["code"] == "GAME_INACTIVE"
