from pathlib import Path
import uuid

from flask_jwt_extended import create_access_token

from app.extensions import db
from app.models import LifeChapter, LifePost, LifePostMedia, Media, User


def make_user(marker, prefix):
    username = f"{prefix}{marker}"[:20]
    return User(
        username=username,
        username_normalized=username,
        email=f"{username}@example.test",
        email_normalized=f"{username}@example.test",
        password_hash="unused",
        nickname=f"内容测试{prefix}",
        can_publish=True,
    )


def headers(user):
    return {"Authorization": f"Bearer {create_access_token(identity=str(user.id))}"}


def make_chapter(marker, suffix, owner, policy="public"):
    normalized = f"{suffix}{marker}"
    return LifeChapter(
        name=f"{suffix}-{marker}",
        normalized_name=normalized,
        dedupe_key=f"root:{normalized}",
        slug=f"{suffix}-{marker}",
        chapter_type="custom",
        creator_id=owner.id,
        status="active",
        review_status="approved",
        contribution_policy=policy,
    )


def make_media(app, owner, marker, media_type="image"):
    key = f"test-flexible-life/{marker}/{uuid.uuid4().hex}.webp"
    thumb = key.replace(".webp", "_thumb.webp")
    for item in (key, thumb):
        path = Path(app.config["UPLOAD_ROOT"]) / item
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"valid-test-image")
    media = Media(
        owner_id=owner.id,
        purpose="content",
        original_filename="test.webp",
        storage_key=key,
        thumbnail_key=thumb,
        mime_type="image/webp",
        size_bytes=16,
        width=20,
        height=20,
        media_type=media_type,
        duration_ms=1200 if media_type == "live_video" else None,
    )
    db.session.add(media)
    db.session.flush()
    return media


def test_flexible_life_content_create_edit_permissions_and_serialization(
    app, client, tmp_path
):
    marker = uuid.uuid4().hex[:8]
    app.config["UPLOAD_ROOT"] = tmp_path
    with app.app_context():
        owner = make_user(marker, "owner")
        contributor = make_user(marker, "writer")
        db.session.add_all([owner, contributor])
        db.session.flush()
        own = make_chapter(marker, "own", owner, "private")
        shared = make_chapter(marker, "shared", owner, "public")
        forbidden = make_chapter(marker, "locked", contributor, "private")
        db.session.add_all([own, shared, forbidden])
        db.session.flush()
        media = make_media(app, owner, marker)
        inline_media = make_media(app, owner, marker)
        cover_media = make_media(app, owner, marker)
        draft_media = make_media(app, owner, marker)
        live_media = make_media(app, owner, marker, "live_video")
        contributor_media = make_media(app, contributor, marker)
        db.session.commit()
        owner_id, contributor_id = owner.id, contributor.id
        own_id, shared_id, forbidden_id = own.id, shared.id, forbidden.id
        media_id, contributor_media_id = media.id, contributor_media.id
        inline_media_id, inline_media_public_id = inline_media.id, inline_media.public_id
        cover_media_id = cover_media.id
        draft_media_id, draft_media_public_id = draft_media.id, draft_media.public_id
        live_media_id = live_media.id
        live_media_public_id = live_media.public_id
        owner_headers, contributor_headers = headers(owner), headers(contributor)
    db.session.remove()

    postable = client.get("/api/v1/life/chapters/postable", headers=owner_headers)
    assert postable.status_code == 200
    assert own_id in {item["id"] for item in postable.json["data"]["owned"]}
    assert shared_id in {item["id"] for item in postable.json["data"]["owned"]}
    assert forbidden_id not in {
        item["id"] for item in postable.json["data"]["contributing"]
    }

    draft = client.post(
        "/api/v1/drafts",
        headers=owner_headers,
        json={
            "draft_type": "life_post",
            "payload": {
                "chapter_id": own_id,
                "title": None,
                "body": "纯文字草稿",
                "content_format": "markdown",
                "external_video_url": "https://youtu.be/example",
            },
            "media_ids": [],
        },
    )
    assert draft.status_code == 201, draft.json
    assert draft.json["data"]["payload"]["content_format"] == "markdown"
    assert draft.json["data"]["payload"]["external_video_url"].startswith("https://")
    assert client.delete(
        f"/api/v1/drafts/{draft.json['data']['id']}",
        headers=owner_headers,
    ).status_code == 204

    media_draft = client.post(
        "/api/v1/drafts",
        headers=owner_headers,
        json={
            "draft_type": "life_post",
            "payload": {
                "chapter_id": own_id,
                "body": f"正文前\n\n{{{{yingmo-media:{draft_media_public_id}}}}}\n\n正文后",
                "content_format": "markdown",
                "cover_media_id": draft_media_id,
            },
            "media_ids": [draft_media_id],
        },
    )
    assert media_draft.status_code == 201, media_draft.json
    assert media_draft.json["data"]["payload"]["cover_media_id"] == draft_media_id
    assert client.delete(
        f"/api/v1/drafts/{media_draft.json['data']['id']}",
        headers=owner_headers,
    ).status_code == 204

    text_post = client.post(
        "/api/v1/life/posts",
        headers=owner_headers,
        json={
            "chapter_id": own_id,
            "title": "   ",
            "body": "  今天完成了项目部署。  ",
            "mood": "",
            "location": "",
            "tags": [],
            "shot_at": None,
        },
    )
    assert text_post.status_code == 201, text_post.json
    assert text_post.json["data"]["title"] is None
    assert text_post.json["data"]["body"] == "今天完成了项目部署。"
    assert text_post.json["data"]["content_format"] == "plain"
    assert text_post.json["data"]["images"] == []

    image_post = client.post(
        "/api/v1/life/posts",
        headers=owner_headers,
        json={"chapter_id": own_id, "media_ids": [media_id]},
    )
    assert image_post.status_code == 201, image_post.json
    assert image_post.json["data"]["body"] is None
    assert len(image_post.json["data"]["media"]) == 1

    video_post = client.post(
        "/api/v1/life/posts",
        headers=owner_headers,
        json={
            "chapter_id": own_id,
            "external_video_url": "https://www.bilibili.com/video/example",
        },
    )
    assert video_post.status_code == 201, video_post.json
    assert video_post.json["data"]["has_external_video"] is True

    markdown_post = client.post(
        "/api/v1/life/posts",
        headers=owner_headers,
        json={
            "chapter_id": shared_id,
            "title": "长文",
            "body": "# 一天\n\n- 写作\n- 散步",
            "content_format": "markdown",
        },
    )
    assert markdown_post.status_code == 201, markdown_post.json
    markdown_id = markdown_post.json["data"]["id"]
    assert markdown_post.json["data"]["content_format"] == "markdown"

    inline_post = client.post(
        "/api/v1/life/posts",
        headers=owner_headers,
        json={
            "chapter_id": own_id,
            "title": "图文交叉",
            "body": f"图片之前\n\n{{{{yingmo-media:{inline_media_public_id}|项目截图}}}}\n\n图片之后",
            "content_format": "markdown",
            "media_ids": [inline_media_id, cover_media_id],
            "cover_media_id": cover_media_id,
        },
    )
    assert inline_post.status_code == 201, inline_post.json
    inline_post_id = inline_post.json["data"]["id"]
    assert inline_post.json["data"]["cover_media_id"] == cover_media_id
    assert inline_post.json["data"]["cover_media"]["id"] == cover_media_id
    assert "|项目截图}}" in inline_post.json["data"]["body"]
    assert inline_post.json["data"]["body"].endswith("图片之后")

    missing_inline_media = client.post(
        "/api/v1/life/posts",
        headers=owner_headers,
        json={
            "chapter_id": own_id,
            "body": f"{{{{yingmo-media:{uuid.uuid4()}}}}}",
            "content_format": "markdown",
            "media_ids": [],
        },
    )
    assert missing_inline_media.status_code == 422
    assert missing_inline_media.json["error"]["details"][0]["code"] == "inline_media_not_attached"

    unattached_cover = client.post(
        "/api/v1/life/posts",
        headers=owner_headers,
        json={
            "chapter_id": own_id,
            "body": "封面没有加入媒体列表",
            "cover_media_id": contributor_media_id,
            "media_ids": [],
        },
    )
    assert unattached_cover.status_code == 422
    assert unattached_cover.json["error"]["details"][0]["code"] == "cover_not_attached"

    live_cover = client.post(
        "/api/v1/life/posts",
        headers=owner_headers,
        json={
            "chapter_id": own_id,
            "body": "Live Photo 只能插入正文",
            "cover_media_id": live_media_id,
            "media_ids": [live_media_id],
        },
    )
    assert live_cover.status_code == 422
    assert live_cover.json["error"]["details"][0]["code"] == "invalid_cover_type"

    inline_live_post = client.post(
        "/api/v1/life/posts",
        headers=owner_headers,
        json={
            "chapter_id": own_id,
            "body": f"实况之前\n\n{{{{yingmo-media:{live_media_public_id}}}}}\n\n实况之后",
            "content_format": "markdown",
            "media_ids": [live_media_id],
        },
    )
    assert inline_live_post.status_code == 201, inline_live_post.json
    assert inline_live_post.json["data"]["media"][0]["media_type"] == "live_video"

    contributor_post = client.post(
        "/api/v1/life/posts",
        headers=contributor_headers,
        json={"chapter_id": shared_id, "body": "共同记录"},
    )
    assert contributor_post.status_code == 201, contributor_post.json

    forbidden_post = client.post(
        "/api/v1/life/posts",
        headers=owner_headers,
        json={"chapter_id": forbidden_id, "body": "不能发布"},
    )
    assert forbidden_post.status_code == 403

    for payload in (
        {"chapter_id": own_id},
        {"chapter_id": own_id, "title": "", "body": "", "media_ids": [], "external_video_url": ""},
    ):
        response = client.post(
            "/api/v1/life/posts", headers=owner_headers, json=payload
        )
        assert response.status_code == 422
        assert response.json["error"]["details"][0]["code"] == "content_required"

    invalid_url = client.post(
        "/api/v1/life/posts",
        headers=owner_headers,
        json={
            "chapter_id": own_id,
            "external_video_url": "javascript:alert(1)",
        },
    )
    assert invalid_url.status_code == 422
    assert invalid_url.json["error"]["details"][0]["field"] == "external_video_url"

    edit_to_text = client.patch(
        f"/api/v1/life/posts/{image_post.json['data']['id']}",
        headers=owner_headers,
        json={"body": "图片移除后保留文字", "media_ids": []},
    )
    assert edit_to_text.status_code == 200, edit_to_text.json
    assert edit_to_text.json["data"]["images"] == []

    empty_edit = client.patch(
        f"/api/v1/life/posts/{text_post.json['data']['id']}",
        headers=owner_headers,
        json={"body": None, "media_ids": [], "external_video_url": None},
    )
    assert empty_edit.status_code == 422

    forbidden_move = client.patch(
        f"/api/v1/life/posts/{markdown_id}",
        headers=owner_headers,
        json={"chapter_id": forbidden_id},
    )
    assert forbidden_move.status_code == 403

    listing = client.get(
        "/api/v1/life/posts",
        query_string={"scope": "mine", "page_size": 100},
        headers=owner_headers,
    )
    assert listing.status_code == 200
    listed = next(item for item in listing.json["data"] if item["id"] == markdown_id)
    assert listed["content_format"] == "markdown"
    assert listed["has_external_video"] is False
    assert listed["excerpt"] == "一天 写作 散步"
    assert listed["like_count"] == 0
    assert listed["comment_count"] == 0
    inline_listed = next(item for item in listing.json["data"] if item["id"] == inline_post_id)
    assert inline_listed["cover_media_id"] == cover_media_id
    assert inline_listed["cover_image"].endswith(f"/{cover_media.public_id}/thumbnail")
    assert inline_listed["excerpt"] == "图片之前 图片之后"

    detail = client.get(f"/api/v1/life/posts/{markdown_id}")
    assert detail.status_code == 200
    assert detail.json["data"]["body"].startswith("# 一天")

    inline_detail = client.get(f"/api/v1/life/posts/{inline_post_id}")
    assert inline_detail.status_code == 200
    assert inline_detail.json["data"]["cover_media"]["id"] == cover_media_id
    assert {item["id"] for item in inline_detail.json["data"]["media"]} == {
        inline_media_id,
        cover_media_id,
    }

    removing_active_cover = client.patch(
        f"/api/v1/life/posts/{inline_post_id}",
        headers=owner_headers,
        json={"media_ids": [inline_media_id]},
    )
    assert removing_active_cover.status_code == 422
    assert removing_active_cover.json["error"]["details"][0]["code"] == "cover_not_attached"

    edit_inline_to_text = client.patch(
        f"/api/v1/life/posts/{inline_post_id}",
        headers=owner_headers,
        json={
            "body": "移除正文媒体后只保留文字",
            "media_ids": [],
            "cover_media_id": None,
        },
    )
    assert edit_inline_to_text.status_code == 200, edit_inline_to_text.json
    assert edit_inline_to_text.json["data"]["cover_media"] is None
    assert edit_inline_to_text.json["data"]["images"] == []

    with app.app_context():
        historical = LifePost(
            author_id=owner_id,
            chapter_id=own_id,
            title="历史内容",
            body="旧正文",
            tags=[],
        )
        db.session.add(historical)
        db.session.flush()
        assert historical.content_format == "plain"
        db.session.rollback()

        post_ids = list(
            db.session.scalars(
                db.select(LifePost.id).where(
                    LifePost.author_id.in_([owner_id, contributor_id])
                )
            )
        )
        if post_ids:
            db.session.execute(
                db.delete(LifePostMedia).where(LifePostMedia.post_id.in_(post_ids))
            )
            db.session.execute(db.delete(LifePost).where(LifePost.id.in_(post_ids)))
        db.session.execute(
            db.delete(LifeChapter).where(
                LifeChapter.id.in_([own_id, shared_id, forbidden_id])
            )
        )
        db.session.execute(
            db.delete(Media).where(Media.owner_id.in_([owner_id, contributor_id]))
        )
        db.session.execute(
            db.delete(User).where(User.id.in_([owner_id, contributor_id]))
        )
        db.session.commit()
