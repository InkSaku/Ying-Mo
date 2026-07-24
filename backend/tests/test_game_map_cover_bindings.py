import uuid
from pathlib import Path
from types import SimpleNamespace

import pytest
from flask_jwt_extended import create_access_token

from app.extensions import db
from app.models import (
    Game,
    GameMap,
    Media,
    User,
    UserRole,
    UserStatus,
)


@pytest.fixture()
def catalog_case(app):
    """为每个测试创建一个具有游戏目录管理权限的系统管理员。"""
    marker = uuid.uuid4().hex[:8]
    username = f"cover{marker}"
    email = f"cover-{marker}@example.com"

    admin = User(
        username=username,
        username_normalized=username,
        email=email,
        email_normalized=email,
        nickname=f"封面测试管理员{marker}",
        role=UserRole.SYSTEM_ADMIN.value,
        status=UserStatus.ACTIVE.value,
        can_publish=True,
        can_comment=True,
    )
    admin.set_password("TestPassword123!")

    db.session.add(admin)
    db.session.commit()

    return SimpleNamespace(
        marker=marker,
        admin_id=admin.id,
        admin_token=create_access_token(identity=str(admin.id)),
    )


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def create_game(client, case, **overrides):
    payload = {
        "name_zh": f"封面测试游戏{case.marker}",
        **overrides,
    }
    response = client.post(
        "/api/v1/games",
        json=payload,
        headers=auth(case.admin_token),
    )
    assert response.status_code == 201
    return response.json["data"]


def create_media(app, case, label):
    key = f"tests/{case.marker}-{label}-{uuid.uuid4().hex}.webp"
    thumbnail_key = (
        f"tests/{case.marker}-{label}-"
        f"{uuid.uuid4().hex}-thumbnail.webp"
    )

    for relative in (key, thumbnail_key):
        path = Path(app.config["UPLOAD_ROOT"]) / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"test-webp")

    media = Media(
        owner_id=case.admin_id,
        purpose="content",
        original_filename=f"{label}.webp",
        storage_key=key,
        thumbnail_key=thumbnail_key,
        mime_type="image/webp",
        size_bytes=9,
        width=16,
        height=9,
    )

    db.session.add(media)
    db.session.commit()

    return media


def create_map(
    client,
    case,
    game_id,
    suffix="",
    cover_media_id=None,
):
    payload = {
        "name_zh": f"封面测试地图{case.marker}{suffix}",
    }

    if cover_media_id is not None:
        payload["cover_media_id"] = cover_media_id

    response = client.post(
        f"/api/v1/games/{game_id}/maps",
        json=payload,
        headers=auth(case.admin_token),
    )
    assert response.status_code == 201

    return response.json["data"]


def test_created_map_cover_uses_map_binding_and_is_public(
    app,
    client,
    catalog_case,
    tmp_path,
):
    app.config["UPLOAD_ROOT"] = tmp_path

    cover = create_media(
        app,
        catalog_case,
        "created-map",
    )
    cover_id = cover.id
    public_id = cover.public_id

    game = create_game(
        client,
        catalog_case,
    )
    game_map = create_map(
        client,
        catalog_case,
        game["id"],
        cover_media_id=cover_id,
    )

    bound = db.session.get(Media, cover_id)

    assert bound.bound_type == "game_map_cover"
    assert bound.bound_id == game_map["id"]

    hero = client.post(
        f"/api/v1/games/{game['id']}/heroes",
        json={
            "name_zh": f"封面测试英雄{catalog_case.marker}",
        },
        headers=auth(catalog_case.admin_token),
    )
    assert hero.status_code == 201

    activated = client.patch(
        f"/api/v1/games/{game['id']}",
        json={"status": "active"},
        headers=auth(catalog_case.admin_token),
    )
    assert activated.status_code == 200

    original_response = client.get(
        f"/api/v1/uploads/images/{public_id}"
    )
    thumbnail_response = client.get(
        f"/api/v1/uploads/images/{public_id}/thumbnail"
    )

    assert original_response.status_code == 200
    assert thumbnail_response.status_code == 200


def test_updated_map_cover_uses_map_binding_and_removes_old_media(
    app,
    client,
    catalog_case,
    tmp_path,
):
    app.config["UPLOAD_ROOT"] = tmp_path

    old_cover = create_media(
        app,
        catalog_case,
        "old-map",
    )
    old_id = old_cover.id
    old_paths = [
        Path(app.config["UPLOAD_ROOT"]) / old_cover.storage_key,
        Path(app.config["UPLOAD_ROOT"]) / old_cover.thumbnail_key,
    ]

    game = create_game(
        client,
        catalog_case,
    )
    game_map = create_map(
        client,
        catalog_case,
        game["id"],
        cover_media_id=old_id,
    )

    new_cover = create_media(
        app,
        catalog_case,
        "new-map",
    )
    new_id = new_cover.id

    response = client.patch(
        (
            f"/api/v1/games/{game['id']}"
            f"/maps/{game_map['id']}"
        ),
        json={"cover_media_id": new_id},
        headers=auth(catalog_case.admin_token),
    )

    assert response.status_code == 200

    replacement = db.session.get(Media, new_id)

    assert replacement.bound_type == "game_map_cover"
    assert replacement.bound_id == game_map["id"]
    assert db.session.get(Media, old_id) is None
    assert all(not path.exists() for path in old_paths)


def test_game_cover_and_hero_avatar_bindings_remain_unchanged(
    app,
    client,
    catalog_case,
    tmp_path,
):
    app.config["UPLOAD_ROOT"] = tmp_path

    game_cover = create_media(
        app,
        catalog_case,
        "game-cover",
    )
    hero_avatar = create_media(
        app,
        catalog_case,
        "hero-avatar",
    )

    game = create_game(
        client,
        catalog_case,
        cover_media_id=game_cover.id,
    )

    replacement_game_cover = create_media(
        app,
        catalog_case,
        "replacement-game-cover",
    )

    game_update = client.patch(
        f"/api/v1/games/{game['id']}",
        json={
            "cover_media_id": replacement_game_cover.id,
        },
        headers=auth(catalog_case.admin_token),
    )
    assert game_update.status_code == 200

    hero_response = client.post(
        f"/api/v1/games/{game['id']}/heroes",
        json={
            "name_zh": f"头像测试英雄{catalog_case.marker}",
            "avatar_media_id": hero_avatar.id,
        },
        headers=auth(catalog_case.admin_token),
    )
    assert hero_response.status_code == 201

    hero_id = hero_response.json["data"]["id"]

    replacement_hero_avatar = create_media(
        app,
        catalog_case,
        "replacement-hero-avatar",
    )

    hero_update = client.patch(
        f"/api/v1/games/{game['id']}/heroes/{hero_id}",
        json={
            "avatar_media_id": replacement_hero_avatar.id,
        },
        headers=auth(catalog_case.admin_token),
    )
    assert hero_update.status_code == 200

    bound_game_cover = db.session.get(
        Media,
        replacement_game_cover.id,
    )
    bound_hero_avatar = db.session.get(
        Media,
        replacement_hero_avatar.id,
    )

    assert bound_game_cover.bound_type == "game_cover"
    assert bound_game_cover.bound_id == game["id"]

    assert bound_hero_avatar.bound_type == "game_hero_avatar"
    assert bound_hero_avatar.bound_id == hero_id

    assert db.session.get(Media, game_cover.id) is None
    assert db.session.get(Media, hero_avatar.id) is None


def test_repair_map_cover_bindings_is_dry_run_safe_and_idempotent(
    app,
    client,
    catalog_case,
    tmp_path,
):
    app.config["UPLOAD_ROOT"] = tmp_path

    game = create_game(
        client,
        catalog_case,
    )
    game_map = create_map(
        client,
        catalog_case,
        game["id"],
    )

    wrong_map_cover = create_media(
        app,
        catalog_case,
        "wrong-map-cover",
    )
    real_game_cover = create_media(
        app,
        catalog_case,
        "real-game-cover",
    )

    wrong_map_cover.bound_type = "game_cover"
    wrong_map_cover.bound_id = game_map["id"]

    real_game_cover.bound_type = "game_cover"
    real_game_cover.bound_id = game["id"]

    stored_map = db.session.get(
        GameMap,
        game_map["id"],
    )
    stored_game = db.session.get(
        Game,
        game["id"],
    )

    stored_map.cover_media_id = wrong_map_cover.id
    stored_game.cover_media_id = real_game_cover.id

    db.session.commit()

    runner = app.test_cli_runner()

    dry_run = runner.invoke(
        args=[
            "repair-map-cover-bindings",
            "--dry-run",
        ]
    )

    assert dry_run.exit_code == 0
    assert (
        f"Map {game_map['id']} "
        f"({game_map['name_zh']}), "
        f"media {wrong_map_cover.id}"
        in dry_run.output
    )
    assert (
        "Would repair 1 invalid map cover bindings."
        in dry_run.output
    )

    db.session.expire_all()

    unchanged = db.session.get(
        Media,
        wrong_map_cover.id,
    )

    assert unchanged.bound_type == "game_cover"
    assert unchanged.bound_id == game_map["id"]

    repaired = runner.invoke(
        args=["repair-map-cover-bindings"]
    )

    assert repaired.exit_code == 0
    assert (
        "Repaired 1 invalid map cover bindings."
        in repaired.output
    )

    db.session.expire_all()

    fixed = db.session.get(
        Media,
        wrong_map_cover.id,
    )
    untouched = db.session.get(
        Media,
        real_game_cover.id,
    )

    assert fixed.bound_type == "game_map_cover"
    assert fixed.bound_id == game_map["id"]

    assert untouched.bound_type == "game_cover"
    assert untouched.bound_id == game["id"]

    repeated = runner.invoke(
        args=["repair-map-cover-bindings"]
    )

    assert repeated.exit_code == 0
    assert (
        "Repaired 0 invalid map cover bindings."
        in repeated.output
    )