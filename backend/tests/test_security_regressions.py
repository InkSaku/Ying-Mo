from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from io import BytesIO
from types import SimpleNamespace
import threading
import uuid

from flask import Flask
from flask_jwt_extended import create_access_token, create_refresh_token, get_csrf_token
from PIL import Image
import pytest

from app.auth import service as auth_service
from app.auth.service import utcnow
from app.extensions import db
from app.guides.service import validate_scope
from app.models import AdminLog, Comment, ContentFavorite, Game, GameGuide, GameHero, LifeChapter, LifePost, Media, Notification, RefreshSession, Report, User
from app.uploads.service import ImageUploadError, _validate_image, process_and_store_image


def image_app(tmp_path, **overrides):
    app = Flask(__name__)
    app.config.update(
        UPLOAD_ROOT=tmp_path,
        IMAGE_MAX_BYTES=1024 * 1024,
        IMAGE_MAX_PIXELS=1_000_000,
        IMAGE_MAX_WIDTH=1000,
        IMAGE_MAX_HEIGHT=1000,
        IMAGE_MAX_ASPECT_RATIO=5,
        IMAGE_THUMBNAIL_MAX_SIDE=100,
        **overrides,
    )
    return app


@pytest.mark.parametrize("raw", [b"not-an-image", b"\x89PNG\r\n\x1a\ncorrupt"])
def test_damaged_images_are_rejected_without_unhandled_errors(tmp_path, raw):
    with image_app(tmp_path).app_context(), pytest.raises(ImageUploadError) as caught:
        _validate_image(raw)
    assert caught.value.code == "UNSUPPORTED_MEDIA_TYPE"


def test_extreme_aspect_ratio_is_rejected_before_transcoding(tmp_path):
    buffer = BytesIO()
    Image.new("RGB", (100, 1), "white").save(buffer, "PNG")
    with image_app(tmp_path).app_context(), pytest.raises(ImageUploadError) as caught:
        _validate_image(buffer.getvalue())
    assert caught.value.code == "IMAGE_DIMENSIONS_EXCEEDED"


def test_image_save_failure_removes_partial_files(tmp_path, monkeypatch):
    buffer = BytesIO()
    Image.new("RGB", (20, 20), "white").save(buffer, "PNG")
    storage = SimpleNamespace(stream=BytesIO(buffer.getvalue()), filename="test.png")
    original_save = Image.Image.save
    calls = 0

    def fail_thumbnail(self, fp, *args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2: raise OSError("disk failure")
        return original_save(self, fp, *args, **kwargs)

    monkeypatch.setattr(Image.Image, "save", fail_thumbnail)
    with image_app(tmp_path).app_context(), pytest.raises(ImageUploadError):
        process_and_store_image(storage)
    assert not list(tmp_path.rglob("*.webp"))


def test_refresh_session_rotation_is_atomic_across_connections(app, monkeypatch):
    marker = uuid.uuid4().hex[:10]
    with app.app_context():
        user = User(username=f"u{marker}", username_normalized=f"u{marker}", email=f"{marker}@example.test", email_normalized=f"{marker}@example.test", password_hash="unused", nickname="并发测试")
        db.session.add(user); db.session.flush()
        user_id = user.id
        old_jti = uuid.uuid4().hex
        db.session.add(RefreshSession(user_id=user_id, jti=old_jti, expires_at=utcnow() + timedelta(hours=1)))
        db.session.commit()

    barrier = threading.Barrier(2)

    def fake_issue_session(user):
        child_jti = uuid.uuid4().hex
        db.session.add(RefreshSession(user_id=user.id, jti=child_jti, expires_at=utcnow() + timedelta(hours=1)))
        return child_jti, child_jti

    monkeypatch.setattr(auth_service, "issue_session", fake_issue_session)

    def rotate():
        with app.app_context():
            barrier.wait()
            result = auth_service.rotate_session(SimpleNamespace(id=user_id), old_jti)
            db.session.commit()
            return result

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _value: rotate(), range(2)))

    assert sum(result is not None for result in results) == 1
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count(RefreshSession.id)).where(RefreshSession.user_id == user_id)) == 2
        db.session.execute(db.delete(User).where(User.id == user_id)); db.session.commit()


def _user(marker, role="user"):
    return User(username=f"u{marker}", username_normalized=f"u{marker}", email=f"{marker}@example.test", email_normalized=f"{marker}@example.test", password_hash="unused", nickname="安全测试", role=role)


@pytest.mark.parametrize(
    ("config_key", "path", "method", "json"),
    [
        ("RATE_LIMIT_REGISTER", "/api/v1/auth/register", "post", {}),
        ("RATE_LIMIT_LOGIN", "/api/v1/auth/login", "post", {}),
        ("RATE_LIMIT_SEARCH", "/api/v1/search?q=测试", "get", None),
    ],
)
def test_high_cost_endpoints_return_unified_rate_limit(app, config_key, path, method, json):
    app.config[config_key] = "1 per minute"
    from app.extensions import limiter
    limiter.reset()
    client = app.test_client()
    getattr(client, method)(path, json=json)
    response = getattr(client, method)(path, json=json)
    assert response.status_code == 429
    assert response.json["error"]["code"] == "RATE_LIMITED"
    assert response.headers["Retry-After"]


def test_authenticated_upload_and_refresh_are_rate_limited(app):
    marker = uuid.uuid4().hex[:10]
    with app.app_context():
        user = _user(marker); db.session.add(user); db.session.commit(); user_id = user.id
        access = create_access_token(identity=str(user.id)); refresh = create_refresh_token(identity=str(user.id)); csrf = get_csrf_token(refresh)
    from app.extensions import limiter
    limiter.reset(); app.config["RATE_LIMIT_UPLOAD"] = "1 per minute"; app.config["RATE_LIMIT_REFRESH"] = "1 per minute"
    client = app.test_client(); access_headers = {"Authorization": f"Bearer {access}"}
    client.post("/api/v1/uploads/images", headers=access_headers)
    upload_limited = client.post("/api/v1/uploads/images", headers=access_headers)
    assert upload_limited.status_code == 429 and upload_limited.json["error"]["code"] == "RATE_LIMITED"
    client.set_cookie(app.config["JWT_REFRESH_COOKIE_NAME"], refresh, path=app.config["JWT_REFRESH_COOKIE_PATH"])
    refresh_headers = {"X-CSRF-TOKEN": csrf}
    client.post("/api/v1/auth/refresh", headers=refresh_headers)
    refresh_limited = client.post("/api/v1/auth/refresh", headers=refresh_headers)
    assert refresh_limited.status_code == 429 and refresh_limited.json["error"]["code"] == "RATE_LIMITED"
    with app.app_context(): db.session.execute(db.delete(User).where(User.id == user_id)); db.session.commit()


def test_pending_and_rejected_chapters_stay_out_of_public_surfaces(app, client):
    marker = uuid.uuid4().hex[:10]
    with app.app_context():
        owner = _user(marker); db.session.add(owner); db.session.flush()
        parent = LifeChapter(name=f"公开{marker}", normalized_name=f"公开{marker}", dedupe_key=f"root:public{marker}", slug=f"public-{marker}", chapter_type="city", creator_id=owner.id, status="active", review_status="approved")
        pending = LifeChapter(name=f"待审{marker}", normalized_name=f"待审{marker}", dedupe_key=f"root:pending{marker}", slug=f"pending-{marker}", chapter_type="city", creator_id=owner.id, status="active", review_status="pending")
        rejected_child = LifeChapter(name=f"驳回{marker}", normalized_name=f"驳回{marker}", dedupe_key=f"child:{marker}", slug=f"rejected-{marker}", chapter_type="scenic", creator_id=owner.id, status="active", review_status="rejected", parent=parent)
        db.session.add_all([parent, pending, rejected_child]); db.session.flush()
        media = Media(owner_id=owner.id, purpose="content", original_filename="x.webp", storage_key=f"missing/{marker}.webp", thumbnail_key=f"missing/{marker}-thumb.webp", mime_type="image/webp", size_bytes=1, width=1, height=1, bound_type="life_chapter_cover", bound_id=pending.id)
        db.session.add(media); db.session.flush(); pending.cover_media_id = media.id; db.session.commit()
        owner_id, chapter_ids, media_id, media_public_id = owner.id, [parent.id, pending.id, rejected_child.id], media.id, media.public_id

    listing = client.get("/api/v1/life/chapters", query_string={"page_size": 100}).json["data"]
    assert {item["id"] for item in listing}.isdisjoint(chapter_ids[1:])
    detail = client.get(f"/api/v1/life/chapters/public-{marker}").json["data"]
    assert detail["children"] == []
    assert client.get(f"/api/v1/life/chapters/pending-{marker}").status_code == 404
    assert client.get(f"/api/v1/uploads/images/{media_public_id}").status_code == 404
    duplicate = client.get("/api/v1/life/chapters/check-name", query_string={"name": f"待审{marker}"}).json["data"]
    assert duplicate["exact_match"] is None

    with app.app_context():
        db.session.execute(db.delete(LifeChapter).where(LifeChapter.id == chapter_ids[2]))
        db.session.execute(db.delete(LifeChapter).where(LifeChapter.id.in_(chapter_ids[:2])))
        db.session.execute(db.delete(Media).where(Media.id == media_id))
        db.session.execute(db.delete(User).where(User.id == owner_id)); db.session.commit()


def test_scope_changes_cannot_select_pending_catalog_entities(app):
    marker = uuid.uuid4().hex[:10]
    with app.app_context():
        owner = _user(marker); db.session.add(owner); db.session.flush()
        game = Game(name_zh=f"游戏{marker}", normalized_name=f"game{marker}", search_text=f"游戏{marker}", slug=f"game-{marker}", aliases=[], created_by_id=owner.id)
        db.session.add(game); db.session.flush()
        hero = GameHero(game_id=game.id, name_zh=f"英雄{marker}", normalized_name=f"hero{marker}", search_text=f"英雄{marker}", slug=f"hero-{marker}", aliases=[], status="active", review_status="pending", created_by_id=owner.id)
        db.session.add(hero); db.session.flush()
        existing = SimpleNamespace(guide_scope="game", game_id=game.id, hero_id=None, map_id=None)
        with pytest.raises(LookupError): validate_scope({"guide_scope": "hero", "hero_id": hero.id}, existing)
        game.status = "inactive"
        validate_scope({}, existing)
        db.session.rollback()


def test_author_cannot_override_admin_guide_validity(app, client):
    marker = uuid.uuid4().hex[:10]
    with app.app_context():
        owner = _user(marker); db.session.add(owner); db.session.flush()
        game = Game(name_zh=f"游戏{marker}", normalized_name=f"game{marker}", search_text=f"游戏{marker}", slug=f"game-{marker}", aliases=[], created_by_id=owner.id)
        db.session.add(game); db.session.flush()
        guide = GameGuide(author_id=owner.id, game_id=game.id, guide_scope="game", title="有效性测试", category="other", instructions="正文", tags=[], search_text="正文", validity_status="invalid", status="published")
        db.session.add(guide); db.session.commit()
        token = create_access_token(identity=str(owner.id)); guide_id, game_id, owner_id = guide.id, game.id, owner.id
    response = client.patch(f"/api/v1/guides/{guide_id}", json={"validity_status": "valid"}, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403
    with app.app_context():
        assert db.session.get(GameGuide, guide_id).validity_status == "invalid"
        db.session.delete(db.session.get(GameGuide, guide_id)); db.session.delete(db.session.get(Game, game_id)); db.session.delete(db.session.get(User, owner_id)); db.session.commit()


def test_report_claim_is_exclusive_across_admin_connections(app):
    marker = uuid.uuid4().hex[:10]
    with app.app_context():
        reporter = _user(f"r{marker}")
        first = _user(f"a{marker}", "content_admin")
        second = _user(f"b{marker}", "content_admin")
        db.session.add_all([reporter, first, second]); db.session.flush()
        report = Report(reporter_id=reporter.id, target_type="user", target_id=reporter.id, reason="spam", status="pending", active_key=f"{reporter.id}:user:{reporter.id}", target_snapshot={})
        db.session.add(report); db.session.commit()
        report_id = report.id; user_ids = [reporter.id, first.id, second.id]
        tokens = [create_access_token(identity=str(first.id)), create_access_token(identity=str(second.id))]
    barrier = threading.Barrier(2)

    def claim(token):
        client = app.test_client(); barrier.wait()
        return client.post(f"/api/v1/admin/reports/{report_id}/claim", headers={"Authorization": f"Bearer {token}"}).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(claim, tokens))
    assert sorted(statuses) == [200, 409]
    with app.app_context():
        assert db.session.get(Report, report_id).assigned_to_id in user_ids[1:]
        db.session.execute(db.delete(AdminLog).where(AdminLog.target_type == "report", AdminLog.target_id == report_id))
        db.session.delete(db.session.get(Report, report_id))
        db.session.execute(db.delete(User).where(User.id.in_(user_ids))); db.session.commit()


def test_report_can_reopen_and_resolve_multiple_rounds(app, client):
    marker = uuid.uuid4().hex[:10]
    with app.app_context():
        reporter = _user(f"r{marker}"); admin = _user(f"s{marker}", "system_admin")
        db.session.add_all([reporter, admin]); db.session.flush()
        report = Report(reporter_id=reporter.id, target_type="user", target_id=reporter.id, reason="spam", status="resolved", active_key=None, review_round=1, target_snapshot={})
        db.session.add(report); db.session.commit()
        report_id, reporter_id, admin_id = report.id, reporter.id, admin.id
        token = create_access_token(identity=str(admin.id))
    headers = {"Authorization": f"Bearer {token}"}
    for expected_round in (2, 3):
        reopened = client.post(f"/api/v1/admin/reports/{report_id}/reopen", headers=headers)
        assert reopened.status_code == 200 and reopened.json["data"]["review_round"] == expected_round
        resolved = client.post(f"/api/v1/admin/reports/{report_id}/resolve", headers=headers, json={"action": "no_action", "resolution_message": f"第 {expected_round} 轮处理"})
        assert resolved.status_code == 200
    with app.app_context():
        keys = list(db.session.scalars(db.select(Notification.dedupe_key).where(Notification.recipient_id == reporter_id, Notification.notification_type == "report_result")))
        assert {f"report-result:{report_id}:2:resolved", f"report-result:{report_id}:3:resolved"}.issubset(keys)
        db.session.execute(db.delete(Notification).where(Notification.recipient_id == reporter_id))
        db.session.execute(db.delete(AdminLog).where(AdminLog.target_type == "report", AdminLog.target_id == report_id))
        db.session.delete(db.session.get(Report, report_id)); db.session.execute(db.delete(User).where(User.id.in_((reporter_id, admin_id)))); db.session.commit()


def test_admin_chapter_operations_cannot_create_a_third_level(app, client):
    marker = uuid.uuid4().hex[:10]
    with app.app_context():
        admin = _user(marker, "content_admin"); db.session.add(admin); db.session.flush()
        first = LifeChapter(name=f"甲{marker}", normalized_name=f"a{marker}", dedupe_key=f"root:a{marker}", slug=f"a-{marker}", chapter_type="city", creator_id=admin.id)
        second = LifeChapter(name=f"乙{marker}", normalized_name=f"b{marker}", dedupe_key=f"root:b{marker}", slug=f"b-{marker}", chapter_type="city", creator_id=admin.id)
        db.session.add_all([first, second]); db.session.flush()
        first_child = LifeChapter(name=f"甲子{marker}", normalized_name=f"ac{marker}", dedupe_key=f"{first.id}:ac{marker}", slug=f"ac-{marker}", chapter_type="scenic", creator_id=admin.id, parent_id=first.id)
        second_child = LifeChapter(name=f"乙子{marker}", normalized_name=f"bc{marker}", dedupe_key=f"{second.id}:bc{marker}", slug=f"bc-{marker}", chapter_type="scenic", creator_id=admin.id, parent_id=second.id)
        db.session.add_all([first_child, second_child]); db.session.commit()
        token = create_access_token(identity=str(admin.id)); ids = [first.id, second.id, first_child.id, second_child.id]; admin_id = admin.id
    headers = {"Authorization": f"Bearer {token}"}
    assert client.patch(f"/api/v1/admin/chapters/{ids[0]}", headers=headers, json={"parent_id": ids[1]}).status_code == 422
    assert client.post(f"/api/v1/admin/chapters/{ids[0]}/merge", headers=headers, json={"target_chapter_id": ids[3], "reason": "层级测试"}).status_code == 409
    with app.app_context():
        db.session.rollback()
        db.session.execute(db.delete(LifeChapter).where(LifeChapter.id.in_(ids[2:])))
        db.session.execute(db.delete(LifeChapter).where(LifeChapter.id.in_(ids[:2])))
        db.session.execute(db.delete(User).where(User.id == admin_id)); db.session.commit()


def test_favorites_and_my_comments_use_consistent_database_pagination(app, client):
    marker = uuid.uuid4().hex[:10]
    with app.app_context():
        user = _user(marker); db.session.add(user); db.session.flush()
        chapter = LifeChapter(name=f"分页{marker}", normalized_name=f"page{marker}", dedupe_key=f"root:page{marker}", slug=f"page-{marker}", chapter_type="city", creator_id=user.id)
        game = Game(name_zh=f"分页游戏{marker}", normalized_name=f"game{marker}", search_text=f"分页游戏{marker}", slug=f"page-game-{marker}", aliases=[], created_by_id=user.id)
        db.session.add_all([chapter, game]); db.session.flush()
        post = LifePost(author_id=user.id, chapter_id=chapter.id, title="分页日常", tags=[], visibility="public", status="published")
        guide = GameGuide(author_id=user.id, game_id=game.id, guide_scope="game", title="分页教材", category="other", instructions="正文", tags=[], search_text="正文", status="published")
        db.session.add_all([post, guide]); db.session.flush()
        db.session.add_all([
            ContentFavorite(user_id=user.id, target_type="life_post", target_id=post.id),
            ContentFavorite(user_id=user.id, target_type="game_guide", target_id=guide.id),
            Comment(author_id=user.id, target_type="life_post", target_id=post.id, body="日常评论"),
            Comment(author_id=user.id, target_type="game_guide", target_id=guide.id, body="教材评论"),
        ]); db.session.commit()
        token = create_access_token(identity=str(user.id)); ids = {"user": user.id, "chapter": chapter.id, "game": game.id, "post": post.id, "guide": guide.id}
    headers = {"Authorization": f"Bearer {token}"}
    favorites = client.get("/api/v1/interactions/favorites?page=1&page_size=1", headers=headers)
    comments = client.get("/api/v1/comments/me?page=1&page_size=1", headers=headers)
    assert favorites.status_code == 200 and len(favorites.json["data"]) == 1 and favorites.json["meta"]["pagination"]["total"] == 2
    assert comments.status_code == 200 and len(comments.json["data"]) == 1 and comments.json["meta"]["pagination"]["total"] == 2
    with app.app_context():
        db.session.execute(db.delete(Comment).where(Comment.author_id == ids["user"]))
        db.session.execute(db.delete(ContentFavorite).where(ContentFavorite.user_id == ids["user"]))
        db.session.execute(db.delete(GameGuide).where(GameGuide.id == ids["guide"]))
        db.session.execute(db.delete(LifePost).where(LifePost.id == ids["post"]))
        db.session.execute(db.delete(Game).where(Game.id == ids["game"]))
        db.session.execute(db.delete(LifeChapter).where(LifeChapter.id == ids["chapter"]))
        db.session.execute(db.delete(User).where(User.id == ids["user"])); db.session.commit()
