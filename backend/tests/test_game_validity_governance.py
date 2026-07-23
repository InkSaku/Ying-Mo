import uuid

import pytest
from flask_jwt_extended import create_access_token

from app.extensions import db
from app.models import AdminLog, Game, GameGuide, GameHero, GameMap, GuideValidityFeedback, Notification, User


def _headers(token, idempotency_key=None):
    headers = {"Authorization": f"Bearer {token}"}
    if idempotency_key: headers["Idempotency-Key"] = idempotency_key
    return headers


@pytest.fixture()
def governance_context(app):
    marker = uuid.uuid4().hex[:8]
    with app.app_context():
        admin = User(username=f"a{marker}", username_normalized=f"a{marker}", email=f"a{marker}@example.test", email_normalized=f"a{marker}@example.test", password_hash="unused", nickname="管理员", role="content_admin")
        author = User(username=f"u{marker}", username_normalized=f"u{marker}", email=f"u{marker}@example.test", email_normalized=f"u{marker}@example.test", password_hash="unused", nickname="作者")
        reporter = User(username=f"r{marker}", username_normalized=f"r{marker}", email=f"r{marker}@example.test", email_normalized=f"r{marker}@example.test", password_hash="unused", nickname="反馈者")
        db.session.add_all([admin, author, reporter])
        db.session.flush()
        game = Game(name_zh=f"治理游戏{marker}", normalized_name=f"game{marker}", search_text=f"治理游戏{marker}", slug=f"game-{marker}", aliases=[], status="active", created_by_id=admin.id)
        other_game = Game(name_zh=f"其他游戏{marker}", normalized_name=f"other{marker}", search_text=f"其他游戏{marker}", slug=f"other-{marker}", aliases=[], status="active", created_by_id=admin.id)
        db.session.add_all([game, other_game])
        db.session.flush()
        heroes = [
            GameHero(game_id=game.id, name_zh=f"英雄甲{marker}", normalized_name=f"ha{marker}", search_text=f"英雄甲{marker}", slug=f"hero-a-{marker}", aliases=[], status="active", review_status="approved", created_by_id=admin.id),
            GameHero(game_id=game.id, name_zh=f"英雄乙{marker}", normalized_name=f"hb{marker}", search_text=f"英雄乙{marker}", slug=f"hero-b-{marker}", aliases=[], status="active", review_status="approved", created_by_id=admin.id),
            GameHero(game_id=other_game.id, name_zh=f"其他英雄{marker}", normalized_name=f"ho{marker}", search_text=f"其他英雄{marker}", slug=f"hero-o-{marker}", aliases=[], status="active", review_status="approved", created_by_id=admin.id),
        ]
        maps = [
            GameMap(game_id=game.id, name_zh=f"地图甲{marker}", normalized_name=f"ma{marker}", search_text=f"地图甲{marker}", slug=f"map-a-{marker}", aliases=[], current_status="active", review_status="approved", created_by_id=admin.id),
            GameMap(game_id=game.id, name_zh=f"地图乙{marker}", normalized_name=f"mb{marker}", search_text=f"地图乙{marker}", slug=f"map-b-{marker}", aliases=[], current_status="active", review_status="approved", created_by_id=admin.id),
            GameMap(game_id=other_game.id, name_zh=f"其他地图{marker}", normalized_name=f"mo{marker}", search_text=f"其他地图{marker}", slug=f"map-o-{marker}", aliases=[], current_status="active", review_status="approved", created_by_id=admin.id),
        ]
        db.session.add_all([*heroes, *maps])
        db.session.flush()
        guides = [
            GameGuide(author_id=author.id, game_id=game.id, map_id=maps[0].id, hero_id=heroes[0].id, guide_scope="hero_map", title="治理点位甲", category="skill_throw", instructions="说明甲", timing=None, tags=[], search_text="说明甲", status="published"),
            GameGuide(author_id=author.id, game_id=game.id, map_id=maps[0].id, hero_id=heroes[1].id, guide_scope="hero_map", title="治理点位乙", category="skill_throw", instructions="说明乙", timing=None, tags=[], search_text="说明乙", status="published"),
        ]
        db.session.add_all(guides)
        db.session.commit()
        context = {
            "admin_id": admin.id,
            "author_id": author.id,
            "reporter_id": reporter.id,
            "admin_token": create_access_token(identity=str(admin.id)),
            "reporter_token": create_access_token(identity=str(reporter.id)),
            "game_ids": [game.id, other_game.id],
            "game_id": game.id,
            "hero_ids": [item.id for item in heroes],
            "map_ids": [item.id for item in maps],
            "guide_ids": [item.id for item in guides],
        }

    yield context

    with app.app_context():
        db.session.execute(db.delete(Notification).where(Notification.recipient_id.in_((context["author_id"], context["reporter_id"]))))
        db.session.execute(db.delete(AdminLog).where(AdminLog.admin_id == context["admin_id"]))
        db.session.execute(db.delete(GuideValidityFeedback).where(GuideValidityFeedback.guide_id.in_(context["guide_ids"])))
        db.session.execute(db.delete(GameGuide).where(GameGuide.id.in_(context["guide_ids"])))
        db.session.execute(db.delete(GameHero).where(GameHero.id.in_(context["hero_ids"])))
        db.session.execute(db.delete(GameMap).where(GameMap.id.in_(context["map_ids"])))
        db.session.execute(db.delete(Game).where(Game.id.in_(context["game_ids"])))
        db.session.execute(db.delete(User).where(User.id.in_((context["admin_id"], context["author_id"], context["reporter_id"]))))
        db.session.commit()


def test_user_feedback_rejects_same_type_and_allows_an_explicit_change(client, governance_context):
    guide_id = governance_context["guide_ids"][0]
    headers = _headers(governance_context["reporter_token"])
    first = client.put(f"/api/v1/guides/{guide_id}/validity-feedback", headers=headers, json={"feedback_type": "valid"})
    duplicate = client.put(f"/api/v1/guides/{guide_id}/validity-feedback", headers=headers, json={"feedback_type": "valid"})
    changed = client.put(f"/api/v1/guides/{guide_id}/validity-feedback", headers=headers, json={"feedback_type": "possibly_invalid"})

    assert first.status_code == 200
    assert first.json["data"]["validity_feedback"]["current_user"] == "valid"
    assert duplicate.status_code == 409
    assert duplicate.json["error"]["code"] == "DUPLICATE_FEEDBACK"
    assert changed.status_code == 200
    assert changed.json["data"]["validity_feedback"]["current_user"] == "possibly_invalid"
    with client.application.app_context():
        feedback = db.session.scalar(db.select(GuideValidityFeedback).where(GuideValidityFeedback.guide_id == guide_id, GuideValidityFeedback.user_id == governance_context["reporter_id"]))
        notification = db.session.scalar(db.select(Notification).where(Notification.dedupe_key == f"guide-feedback:{guide_id}:{governance_context['reporter_id']}"))
        assert feedback.feedback_type == "possibly_invalid"
        assert notification.payload["feedback_type"] == "possibly_invalid"


def test_admin_validity_change_requires_reason_logs_and_notifies(client, governance_context):
    guide_id = governance_context["guide_ids"][0]
    headers = _headers(governance_context["admin_token"])
    missing = client.patch(f"/api/v1/admin/guides/{guide_id}/validity", headers=headers, json={"validity_status": "invalid"})
    changed = client.patch(f"/api/v1/admin/guides/{guide_id}/validity", headers=headers, json={"validity_status": "possibly_invalid", "reason": "版本更新后需要复核"})

    assert missing.status_code == 422
    assert changed.status_code == 200
    assert changed.json["data"]["validity_status"] == "possibly_invalid"
    assert changed.json["data"]["last_confirmed_at"]
    with client.application.app_context():
        log = db.session.scalar(db.select(AdminLog).where(AdminLog.action == "guide_validity_updated", AdminLog.target_id == guide_id))
        notification = db.session.scalar(db.select(Notification).where(Notification.notification_type == "guide_validity_changed", Notification.target_id == guide_id))
        assert log.metadata_json["reason"] == "版本更新后需要复核"
        assert notification.recipient_id == governance_context["author_id"]
        assert notification.payload["validity_status"] == "possibly_invalid"


def test_admin_metadata_correction_enforces_one_game_and_notifies_author(client, governance_context):
    guide_id = governance_context["guide_ids"][0]
    headers = _headers(governance_context["admin_token"])
    invalid = client.patch(
        f"/api/v1/admin/guides/{guide_id}/metadata",
        headers=headers,
        json={"game_id": governance_context["game_id"], "map_id": governance_context["map_ids"][2], "hero_id": governance_context["hero_ids"][0], "category": "skill_throw", "reason": "错误关联测试"},
    )
    corrected = client.patch(
        f"/api/v1/admin/guides/{guide_id}/metadata",
        headers=headers,
        json={"game_id": governance_context["game_id"], "map_id": governance_context["map_ids"][1], "hero_id": governance_context["hero_ids"][1], "category": "hold_position", "reason": "作者选择有误"},
    )

    assert invalid.status_code == 422
    assert corrected.status_code == 200
    assert corrected.json["data"]["map"]["id"] == governance_context["map_ids"][1]
    assert corrected.json["data"]["hero"]["id"] == governance_context["hero_ids"][1]
    assert corrected.json["data"]["category"] == "hold_position"
    with client.application.app_context():
        assert db.session.scalar(db.select(AdminLog.id).where(AdminLog.action == "guide_metadata_updated", AdminLog.target_id == guide_id))
        notification = db.session.scalar(db.select(Notification).where(Notification.notification_type == "system", Notification.target_id == guide_id))
        assert notification.recipient_id == governance_context["author_id"]


def test_bulk_mark_is_scoped_logged_notified_and_idempotent(client, governance_context):
    key = str(uuid.uuid4())
    headers = _headers(governance_context["admin_token"], key)
    payload = {
        "game_id": governance_context["game_id"],
        "map_id": governance_context["map_ids"][0],
        "reason": "地图轮换，需要重新确认",
        "confirmation": "BULK_POSSIBLY_INVALID",
    }
    first = client.post("/api/v1/admin/guides/bulk-possibly-invalid", headers=headers, json=payload)
    repeated = client.post("/api/v1/admin/guides/bulk-possibly-invalid", headers=headers, json=payload)
    invalid_scope = client.post(
        "/api/v1/admin/guides/bulk-possibly-invalid",
        headers=_headers(governance_context["admin_token"], str(uuid.uuid4())),
        json={**payload, "map_id": governance_context["map_ids"][2]},
    )

    assert first.status_code == 200
    assert first.json["data"]["updated"] == 2
    assert repeated.status_code == 200
    assert repeated.json["data"] == {"updated": 0, "already_processed": True}
    assert invalid_scope.status_code == 422
    with client.application.app_context():
        guides = db.session.scalars(db.select(GameGuide).where(GameGuide.id.in_(governance_context["guide_ids"]))).all()
        logs = db.session.scalars(db.select(AdminLog).where(AdminLog.action == "guide_bulk_possibly_invalid", AdminLog.target_id.in_(governance_context["guide_ids"]))).all()
        notifications = db.session.scalars(db.select(Notification).where(Notification.notification_type == "guide_validity_changed", Notification.target_id.in_(governance_context["guide_ids"]))).all()
        assert all(item.validity_status == "possibly_invalid" for item in guides)
        assert len(logs) == 2
        assert len(notifications) == 2


def test_admin_catalog_reports_related_historical_guide_counts(client, governance_context):
    headers = _headers(governance_context["admin_token"])
    heroes = client.get("/api/v1/admin/catalog/heroes", headers=headers, query_string={"game_id": governance_context["game_id"], "page_size": 100})
    maps = client.get("/api/v1/admin/catalog/maps", headers=headers, query_string={"game_id": governance_context["game_id"], "page_size": 100})

    assert heroes.status_code == 200
    assert maps.status_code == 200
    hero_counts = {item["id"]: item["guide_count"] for item in heroes.json["data"]}
    map_counts = {item["id"]: item["guide_count"] for item in maps.json["data"]}
    assert hero_counts[governance_context["hero_ids"][0]] == 1
    assert hero_counts[governance_context["hero_ids"][1]] == 1
    assert map_counts[governance_context["map_ids"][0]] == 2
