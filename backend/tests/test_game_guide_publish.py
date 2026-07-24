import uuid

import pytest
from flask_jwt_extended import create_access_token

from app.extensions import db
from app.models import ContentDraft, ContentDraftMedia, Game, GameGuide, GameGuideStep, GameHero, GameMap, Media, User


def _catalog_item(model, game_id, owner_id, marker, name, **values):
    return model(
        game_id=game_id,
        name_zh=name,
        normalized_name=f"{name}{marker}".casefold(),
        search_text=f"{name}{marker}",
        slug=f"{name.lower()}-{marker}",
        aliases=[],
        created_by_id=owner_id,
        **values,
    )


@pytest.fixture()
def publish_context(app, tmp_path):
    marker = uuid.uuid4().hex[:8]
    app.config["UPLOAD_ROOT"] = tmp_path
    with app.app_context():
        owner = User(
            username=f"p{marker}",
            username_normalized=f"p{marker}",
            email=f"p{marker}@example.test",
            email_normalized=f"p{marker}@example.test",
            password_hash="unused",
            nickname="发布者",
        )
        other = User(
            username=f"q{marker}",
            username_normalized=f"q{marker}",
            email=f"q{marker}@example.test",
            email_normalized=f"q{marker}@example.test",
            password_hash="unused",
            nickname="其他用户",
        )
        db.session.add_all([owner, other])
        db.session.flush()
        games = [
            Game(name_zh=f"启用游戏{marker}", normalized_name=f"active{marker}", search_text=f"启用游戏{marker}", slug=f"active-{marker}", aliases=[], status="active", created_by_id=owner.id),
            Game(name_zh=f"停用游戏{marker}", normalized_name=f"inactive{marker}", search_text=f"停用游戏{marker}", slug=f"inactive-{marker}", aliases=[], status="inactive", created_by_id=owner.id),
            Game(name_zh=f"其他游戏{marker}", normalized_name=f"other{marker}", search_text=f"其他游戏{marker}", slug=f"other-{marker}", aliases=[], status="active", created_by_id=owner.id),
        ]
        db.session.add_all(games)
        db.session.flush()
        active_game, inactive_game, other_game = games
        heroes = [
            _catalog_item(GameHero, active_game.id, owner.id, marker, "安娜", status="active", review_status="approved"),
            _catalog_item(GameHero, active_game.id, owner.id, marker, "停用英雄", status="inactive", review_status="approved"),
            _catalog_item(GameHero, inactive_game.id, owner.id, marker, "停用目录英雄", status="active", review_status="approved"),
            _catalog_item(GameHero, other_game.id, owner.id, marker, "其他英雄", status="active", review_status="approved"),
        ]
        maps = [
            _catalog_item(GameMap, active_game.id, owner.id, marker, "国王大道", current_status="active", review_status="approved"),
            _catalog_item(GameMap, active_game.id, owner.id, marker, "退役地图", current_status="retired", review_status="approved"),
            _catalog_item(GameMap, inactive_game.id, owner.id, marker, "停用目录地图", current_status="active", review_status="approved"),
            _catalog_item(GameMap, other_game.id, owner.id, marker, "其他地图", current_status="active", review_status="approved"),
        ]
        db.session.add_all([*heroes, *maps])
        db.session.flush()

        media = []
        for index, user in enumerate((owner, other), 1):
            storage_key = f"{marker}/image-{index}.webp"
            thumbnail_key = f"{marker}/image-{index}-thumb.webp"
            for key in (storage_key, thumbnail_key):
                path = tmp_path / key
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b"webp")
            media.append(Media(
                owner_id=user.id,
                purpose="content",
                original_filename=f"image-{index}.webp",
                storage_key=storage_key,
                thumbnail_key=thumbnail_key,
                mime_type="image/webp",
                size_bytes=4,
                width=1,
                height=1,
            ))
        db.session.add_all(media)
        db.session.commit()
        context = {
            "owner_id": owner.id,
            "other_id": other.id,
            "token": create_access_token(identity=str(owner.id)),
            "active_game": active_game.id,
            "inactive_game": inactive_game.id,
            "other_game": other_game.id,
            "active_hero": heroes[0].id,
            "inactive_hero": heroes[1].id,
            "inactive_game_hero": heroes[2].id,
            "other_hero": heroes[3].id,
            "active_map": maps[0].id,
            "retired_map": maps[1].id,
            "inactive_game_map": maps[2].id,
            "other_map": maps[3].id,
            "owner_media": media[0].id,
            "other_media": media[1].id,
            "game_ids": [item.id for item in games],
            "hero_ids": [item.id for item in heroes],
            "map_ids": [item.id for item in maps],
            "media_ids": [item.id for item in media],
        }

    yield context

    with app.app_context():
        guide_ids = list(db.session.scalars(db.select(GameGuide.id).where(GameGuide.author_id == context["owner_id"])))
        if guide_ids:
            db.session.execute(db.delete(GameGuideStep).where(GameGuideStep.guide_id.in_(guide_ids)))
            db.session.execute(db.delete(GameGuide).where(GameGuide.id.in_(guide_ids)))
        draft_ids = list(db.session.scalars(db.select(ContentDraft.id).where(ContentDraft.owner_id == context["owner_id"])))
        if draft_ids:
            db.session.execute(db.delete(ContentDraftMedia).where(ContentDraftMedia.draft_id.in_(draft_ids)))
            db.session.execute(db.delete(ContentDraft).where(ContentDraft.id.in_(draft_ids)))
        db.session.execute(db.delete(Media).where(Media.id.in_(context["media_ids"])))
        db.session.execute(db.delete(GameHero).where(GameHero.id.in_(context["hero_ids"])))
        db.session.execute(db.delete(GameMap).where(GameMap.id.in_(context["map_ids"])))
        db.session.execute(db.delete(Game).where(Game.id.in_(context["game_ids"])))
        db.session.execute(db.delete(User).where(User.id.in_((context["owner_id"], context["other_id"]))))
        db.session.commit()


def _headers(context):
    return {"Authorization": f"Bearer {context['token']}"}


def _payload(context, **overrides):
    value = {
        "game_id": context["active_game"],
        "map_id": context["active_map"],
        "hero_id": context["active_hero"],
        "guide_scope": "hero_map",
        "content_mode": "simple",
        "title": "睡眠针点位",
        "category": "skill_throw",
        "instructions": "站在转角处对准招牌投掷。",
        "video_url": "https://example.test/guide",
        "steps": [],
    }
    value.update(overrides)
    return value


def _detail(response, field):
    return next(item for item in response.json["error"]["details"] if item["field"] == field)


@pytest.mark.parametrize(
    ("field", "context_key"),
    (("hero_id", "other_hero"), ("map_id", "other_map")),
)
def test_catalog_selection_must_belong_to_one_game(client, publish_context, field, context_key):
    response = client.post(
        "/api/v1/guides",
        headers=_headers(publish_context),
        json=_payload(publish_context, **{field: publish_context[context_key]}),
    )

    assert response.status_code == 422
    assert _detail(response, field)["code"] == "game_mismatch"


def test_inactive_game_cannot_create_a_guide(client, publish_context):
    response = client.post(
        "/api/v1/guides",
        headers=_headers(publish_context),
        json=_payload(
            publish_context,
            game_id=publish_context["inactive_game"],
            map_id=publish_context["inactive_game_map"],
            hero_id=publish_context["inactive_game_hero"],
        ),
    )

    assert response.status_code == 422
    assert _detail(response, "game_id")["code"] == "unavailable"


def test_inactive_hero_cannot_create_a_guide(client, publish_context):
    response = client.post(
        "/api/v1/guides",
        headers=_headers(publish_context),
        json=_payload(publish_context, hero_id=publish_context["inactive_hero"]),
    )

    assert response.status_code == 422
    assert _detail(response, "hero_id")["code"] == "unavailable"


def test_retired_map_cannot_create_a_guide(client, publish_context):
    response = client.post(
        "/api/v1/guides",
        headers=_headers(publish_context),
        json=_payload(publish_context, map_id=publish_context["retired_map"]),
    )

    assert response.status_code == 422
    assert _detail(response, "map_id")["code"] == "unavailable"


def test_timed_throw_requires_timing(client, publish_context):
    response = client.post(
        "/api/v1/guides",
        headers=_headers(publish_context),
        json=_payload(publish_context, category="timed_throw", timing=""),
    )

    assert response.status_code == 422
    assert _detail(response, "timing")["code"] == "required"


def test_published_guide_requires_an_image_or_video(client, publish_context):
    response = client.post(
        "/api/v1/guides",
        headers=_headers(publish_context),
        json=_payload(publish_context, video_url=""),
    )

    assert response.status_code == 422
    assert _detail(response, "visualization")["code"] == "required"


def test_guide_rejects_another_users_image(client, publish_context):
    response = client.post(
        "/api/v1/guides",
        headers=_headers(publish_context),
        json=_payload(
            publish_context,
            video_url="",
            steps=[{"media_id": publish_context["other_media"], "title": None, "description": None}],
        ),
    )

    assert response.status_code == 409
    assert _detail(response, "steps")["code"] == "ownership"


def test_guide_rejects_duplicate_images(client, publish_context):
    step = {"media_id": publish_context["owner_media"], "title": None, "description": None}
    response = client.post(
        "/api/v1/guides",
        headers=_headers(publish_context),
        json=_payload(publish_context, video_url="", steps=[step, step]),
    )

    assert response.status_code == 422
    assert _detail(response, "steps")["code"] == "invalid_format"


def test_incomplete_draft_can_convert_to_a_published_guide(client, publish_context):
    draft = client.post(
        "/api/v1/drafts",
        headers=_headers(publish_context),
        json={
            "draft_type": "game_guide",
            "payload": {
                "game_id": None,
                "map_id": None,
                "hero_id": None,
                "guide_scope": "hero_map",
                "content_mode": "simple",
                "title": "",
                "category": "skill_throw",
                "instructions": "",
                "steps": [{"media_id": publish_context["owner_media"], "title": None, "description": None}],
            },
            "media_ids": [publish_context["owner_media"]],
        },
    )
    assert draft.status_code == 201

    response = client.post(
        "/api/v1/guides",
        headers=_headers(publish_context),
        json={
            **_payload(
                publish_context,
                video_url="",
                steps=[{"media_id": publish_context["owner_media"], "title": None, "description": None}],
            ),
            "draft_id": draft.json["data"]["id"],
        },
    )

    assert response.status_code == 201
    assert response.json["data"]["image_count"] == 1
    with client.application.app_context():
        assert db.session.get(ContentDraft, draft.json["data"]["id"]) is None


def test_successful_publish_and_historical_inactive_edit(client, publish_context):
    created = client.post(
        "/api/v1/guides",
        headers=_headers(publish_context),
        json=_payload(publish_context),
    )
    assert created.status_code == 201
    guide_id = created.json["data"]["id"]

    with client.application.app_context():
        db.session.get(Game, publish_context["active_game"]).status = "inactive"
        db.session.get(GameHero, publish_context["active_hero"]).status = "inactive"
        db.session.get(GameMap, publish_context["active_map"]).current_status = "retired"
        db.session.commit()

    edited = client.patch(
        f"/api/v1/guides/{guide_id}",
        headers=_headers(publish_context),
        json=_payload(publish_context, title="历史点位仍可编辑"),
    )

    assert edited.status_code == 200
    assert edited.json["data"]["title"] == "历史点位仍可编辑"
    assert edited.json["data"]["game"]["is_available"] is False
    assert edited.json["data"]["map"]["is_available"] is False
    assert edited.json["data"]["hero"]["is_available"] is False
