from pathlib import Path
import uuid

from flask_jwt_extended import create_access_token

from app.extensions import db
from app.models import (
    AdminLog,
    Comment,
    ContentFavorite,
    ContentLike,
    FeaturedContent,
    LifeChapter,
    LifePost,
    LifePostMedia,
    Media,
    Notification,
    Report,
    User,
)


def _user(marker, suffix, role="user", can_publish=True):
    username = f"{suffix}{marker}"[:20]
    email = f"{suffix}{marker}@example.test"
    return User(
        username=username,
        username_normalized=username,
        email=email,
        email_normalized=email,
        password_hash="unused",
        nickname=f"章节测试{suffix}",
        role=role,
        can_publish=can_publish,
    )


def _headers(user):
    return {"Authorization": f"Bearer {create_access_token(identity=str(user.id))}"}


def _chapter(marker, suffix, owner, **overrides):
    normalized = f"{suffix}{marker}"
    values = {
        "name": f"{suffix}-{marker}",
        "normalized_name": normalized,
        "dedupe_key": f"root:{normalized}",
        "slug": f"{suffix}-{marker}",
        "chapter_type": "city",
        "creator_id": owner.id,
        "status": "active",
        "review_status": "approved",
        "contribution_policy": "public",
    }
    values.update(overrides)
    return LifeChapter(**values)


def _media(app, owner, marker, *, bound_type=None, bound_id=None):
    key = f"test-life/{marker}/{uuid.uuid4().hex}.webp"
    thumb = key.replace(".webp", "_thumb.webp")
    root = Path(app.config["UPLOAD_ROOT"])
    for item in (key, thumb):
        path = root / item
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
        bound_type=bound_type,
        bound_id=bound_id,
    )
    db.session.add(media)
    db.session.flush()
    return media


def _cleanup(user_ids):
    post_ids = list(
        db.session.scalars(
            db.select(LifePost.id).where(LifePost.author_id.in_(user_ids))
        )
    )
    chapter_ids = list(
        db.session.scalars(
            db.select(LifeChapter.id).where(LifeChapter.creator_id.in_(user_ids))
        )
    )
    if post_ids:
        db.session.execute(
            db.delete(FeaturedContent).where(
                FeaturedContent.target_type == "life_post",
                FeaturedContent.target_id.in_(post_ids),
            )
        )
        db.session.execute(
            db.delete(Report).where(
                Report.target_type == "life_post",
                Report.target_id.in_(post_ids),
            )
        )
        db.session.execute(
            db.delete(Comment).where(
                Comment.target_type == "life_post",
                Comment.target_id.in_(post_ids),
            )
        )
        db.session.execute(
            db.delete(Notification).where(
                Notification.target_type == "life_post",
                Notification.target_id.in_(post_ids),
            )
        )
        db.session.execute(
            db.delete(ContentLike).where(
                ContentLike.target_type == "life_post",
                ContentLike.target_id.in_(post_ids),
            )
        )
        db.session.execute(
            db.delete(ContentFavorite).where(
                ContentFavorite.target_type == "life_post",
                ContentFavorite.target_id.in_(post_ids),
            )
        )
        db.session.execute(
            db.delete(LifePostMedia).where(LifePostMedia.post_id.in_(post_ids))
        )
        db.session.execute(db.delete(LifePost).where(LifePost.id.in_(post_ids)))
    db.session.execute(
        db.delete(Notification).where(
            (Notification.recipient_id.in_(user_ids))
            | (Notification.actor_id.in_(user_ids))
        )
    )
    if chapter_ids:
        db.session.execute(
            db.update(LifeChapter)
            .where(LifeChapter.id.in_(chapter_ids))
            .values(parent_id=None, merged_into_id=None, cover_media_id=None)
        )
        db.session.execute(
            db.delete(AdminLog).where(
                AdminLog.target_type == "life_chapter",
                AdminLog.target_id.in_(chapter_ids),
            )
        )
        db.session.execute(
            db.delete(LifeChapter).where(LifeChapter.id.in_(chapter_ids))
        )
    db.session.execute(db.delete(Media).where(Media.owner_id.in_(user_ids)))
    db.session.execute(db.delete(AdminLog).where(AdminLog.admin_id.in_(user_ids)))
    db.session.execute(db.delete(User).where(User.id.in_(user_ids)))
    db.session.commit()


def test_create_browse_and_contribution_policy_permissions(app, client, tmp_path):
    marker = uuid.uuid4().hex[:8]
    app.config["UPLOAD_ROOT"] = tmp_path
    with app.app_context():
        owner = _user(marker, "o")
        other = _user(marker, "u")
        admin = _user(marker, "a", "content_admin")
        restricted = _user(marker, "r", can_publish=False)
        db.session.add_all([owner, other, admin, restricted])
        db.session.commit()
        user_ids = [owner.id, other.id, admin.id, restricted.id]
        tokens = {
            "owner": _headers(owner),
            "other": _headers(other),
            "admin": _headers(admin),
            "restricted": _headers(restricted),
        }

    try:
        public_created = client.post(
            "/api/v1/life/chapters",
            headers=tokens["owner"],
            json={
                "name": f"公有{marker}",
                "chapter_type": "city",
                "contribution_policy": "public",
            },
        )
        private_created = client.post(
            "/api/v1/life/chapters",
            headers=tokens["owner"],
            json={
                "name": f"私有{marker}",
                "chapter_type": "travel",
                "contribution_policy": "private",
            },
        )
        default_created = client.post(
            "/api/v1/life/chapters",
            headers=tokens["owner"],
            json={"name": f"默认{marker}", "chapter_type": "custom"},
        )
        assert public_created.status_code == 201
        assert private_created.status_code == 201
        assert private_created.json["data"]["review_status"] == "pending"
        assert private_created.json["data"]["status"] == "active"
        assert private_created.json["data"]["contribution_policy"] == "private"
        assert default_created.json["data"]["contribution_policy"] == "public"
        my_chapters = client.get(
            "/api/v1/users/me/chapters",
            headers=tokens["owner"],
            query_string={"page_size": 100},
        )
        assert my_chapters.status_code == 200
        assert {
            public_created.json["data"]["id"],
            private_created.json["data"]["id"],
            default_created.json["data"]["id"],
        }.issubset({item["id"] for item in my_chapters.json["data"]})
        invalid = client.post(
            "/api/v1/life/chapters",
            headers=tokens["owner"],
            json={
                "name": f"非法{marker}",
                "chapter_type": "city",
                "contribution_policy": "friends",
            },
        )
        assert invalid.status_code == 422
        assert invalid.json["error"]["details"][0]["field"] == "contribution_policy"
        assert client.post(
            "/api/v1/life/chapters",
            headers=tokens["restricted"],
            json={"name": f"受限{marker}", "chapter_type": "city"},
        ).status_code == 403

        public_id = public_created.json["data"]["id"]
        private_id = private_created.json["data"]["id"]
        private_slug = private_created.json["data"]["slug"]
        with app.app_context():
            pending_chapter = db.session.get(LifeChapter, private_id)
            pending_cover = _media(
                app,
                db.session.get(User, user_ids[0]),
                f"{marker}-pending-cover",
                bound_type="life_chapter_cover",
                bound_id=private_id,
            )
            pending_chapter.cover_media_id = pending_cover.id
            db.session.commit()
            pending_cover_public_id = pending_cover.public_id
        db.session.remove()
        assert client.get(
            f"/api/v1/uploads/images/{pending_cover_public_id}",
            headers=tokens["owner"],
        ).status_code == 200
        assert client.get(
            f"/api/v1/uploads/images/{pending_cover_public_id}",
        ).status_code == 404
        pending_list = client.get(
            "/api/v1/life/chapters", query_string={"page_size": 100}
        )
        pending_ids = {item["id"] for item in pending_list.json["data"]}
        assert public_id not in pending_ids
        assert private_id not in pending_ids
        assert client.post(
            f"/api/v1/admin/chapters/{public_id}/approve",
            headers=tokens["admin"],
            json={},
        ).status_code == 200
        assert client.post(
            f"/api/v1/admin/chapters/{private_id}/approve",
            headers=tokens["admin"],
            json={},
        ).status_code == 200
        with app.app_context():
            upload_ids = {}
            for name, user_id in (
                ("other_public", user_ids[1]),
                ("other_private", user_ids[1]),
                ("owner_private", user_ids[0]),
                ("admin_private", user_ids[2]),
            ):
                upload_ids[name] = _media(
                    app, db.session.get(User, user_id), f"{marker}-{name}"
                ).id
            db.session.commit()
        # The shared app fixture keeps an outer scoped session alive. Reset it
        # after direct fixture writes so client requests see the committed rows.
        db.session.remove()

        anonymous_list = client.get(
            "/api/v1/life/chapters", query_string={"page_size": 100}
        )
        listed_ids = {item["id"] for item in anonymous_list.json["data"]}
        assert private_id in listed_ids
        search_result = client.get(
            "/api/v1/search",
            query_string={
                "q": f"私有{marker}",
                "scope": "life_chapter",
            },
        )
        assert search_result.status_code == 200
        assert private_id in {
            item["content"]["id"]
            for item in search_result.json["data"]
        }
        anonymous_detail = client.get(
            f"/api/v1/life/chapters/{private_slug}"
        ).json["data"]
        assert anonymous_detail["contribution_policy"] == "private"
        assert anonymous_detail["can_post"] is False
        admin_detail = client.get(
            f"/api/v1/life/chapters/{private_slug}", headers=tokens["admin"]
        ).json["data"]
        assert admin_detail["can_edit"] is True
        assert admin_detail["can_post"] is False

        def publish(headers, chapter_id, media_id):
            return client.post(
                "/api/v1/life/posts",
                headers=headers,
                json={
                    "title": "投稿权限测试",
                    "chapter_id": chapter_id,
                    "media_ids": [media_id],
                },
            )

        public_post = publish(
            tokens["other"], public_id, upload_ids["other_public"]
        )
        assert public_post.status_code == 201, public_post.json
        forbidden = publish(
            tokens["other"], private_id, upload_ids["other_private"]
        )
        assert forbidden.status_code == 403
        assert "仅允许创建者投稿" in forbidden.json["error"]["message"]
        assert publish(
            tokens["owner"], private_id, upload_ids["owner_private"]
        ).status_code == 201
        assert publish(
            tokens["admin"], private_id, upload_ids["admin_private"]
        ).status_code == 403
    finally:
        with app.app_context():
            _cleanup(user_ids)


def test_full_edit_cover_transaction_and_existing_post_compatibility(
    app, client, tmp_path
):
    marker = uuid.uuid4().hex[:8]
    app.config["UPLOAD_ROOT"] = tmp_path
    with app.app_context():
        owner = _user(marker, "o")
        other = _user(marker, "u")
        admin = _user(marker, "a", "content_admin")
        db.session.add_all([owner, other, admin])
        db.session.flush()
        chapter = _chapter(marker, "edit", owner)
        target = _chapter(
            marker,
            "private",
            owner,
            contribution_policy="private",
        )
        own_private_target = _chapter(
            marker,
            "other-private",
            other,
            contribution_policy="private",
        )
        db.session.add_all([chapter, target, own_private_target])
        db.session.flush()
        old_cover = _media(
            app,
            owner,
            f"{marker}-old",
            bound_type="life_chapter_cover",
            bound_id=chapter.id,
        )
        chapter.cover_media_id = old_cover.id
        new_cover = _media(app, owner, f"{marker}-new")
        other_cover = _media(app, other, f"{marker}-other")
        admin_cover = _media(app, admin, f"{marker}-admin")
        post_media = _media(
            app,
            other,
            f"{marker}-post",
            bound_type="life_post",
        )
        post = LifePost(
            author_id=other.id,
            chapter_id=chapter.id,
            title="已有日常",
            tags=[],
        )
        db.session.add(post)
        db.session.flush()
        post_media.bound_id = post.id
        db.session.add(
            LifePostMedia(post_id=post.id, media_id=post_media.id, position=0)
        )
        db.session.commit()
        ids = {
            "chapter": chapter.id,
            "target": target.id,
            "own_target": own_private_target.id,
            "post": post.id,
            "old": old_cover.id,
            "new": new_cover.id,
            "other_cover": other_cover.id,
            "admin_cover": admin_cover.id,
        }
        old_slug = chapter.slug
        old_paths = [
            Path(app.config["UPLOAD_ROOT"]) / old_cover.storage_key,
            Path(app.config["UPLOAD_ROOT"]) / old_cover.thumbnail_key,
        ]
        user_ids = [owner.id, other.id, admin.id]
        tokens = {
            "owner": _headers(owner),
            "other": _headers(other),
            "admin": _headers(admin),
        }
    try:
        assert client.patch(
            f"/api/v1/life/chapters/{ids['chapter']}",
            headers=tokens["other"],
            json={"name": "越权"},
        ).status_code == 403
        edited = client.patch(
            f"/api/v1/life/chapters/{ids['chapter']}",
            headers=tokens["owner"],
            json={
                "name": f"重命名{marker}",
                "description": "完整字段已保存",
                "contribution_policy": "private",
                "cover_media_id": ids["new"],
            },
        )
        assert edited.status_code == 200
        assert edited.json["data"]["slug"] == old_slug
        assert edited.json["data"]["contribution_policy"] == "private"
        with app.app_context():
            assert db.session.get(Media, ids["old"]) is None
            assert all(not path.exists() for path in old_paths)

        wrong_cover = client.patch(
            f"/api/v1/life/chapters/{ids['chapter']}",
            headers=tokens["owner"],
            json={"cover_media_id": ids["other_cover"]},
        )
        assert wrong_cover.status_code == 403
        removed = client.patch(
            f"/api/v1/life/chapters/{ids['chapter']}",
            headers=tokens["owner"],
            json={"cover_media_id": None},
        )
        assert removed.status_code == 200
        assert removed.json["data"]["cover_url"] is None

        admin_edit = client.patch(
            f"/api/v1/admin/chapters/{ids['chapter']}",
            headers=tokens["admin"],
            json={
                "aliases": ["旧名称"],
                "review_note": "管理员备注",
                "cover_media_id": ids["admin_cover"],
            },
        )
        assert admin_edit.status_code == 200
        assert admin_edit.json["data"]["aliases"] == ["旧名称"]
        assert admin_edit.json["data"]["cover_media_id"] == ids["admin_cover"]
        assert admin_edit.json["data"]["can_post"] is False

        same_chapter = client.patch(
            f"/api/v1/life/posts/{ids['post']}",
            headers=tokens["other"],
            json={"chapter_id": ids["chapter"], "title": "仍可编辑"},
        )
        assert same_chapter.status_code == 200
        moved_private = client.patch(
            f"/api/v1/life/posts/{ids['post']}",
            headers=tokens["other"],
            json={"chapter_id": ids["target"]},
        )
        assert moved_private.status_code == 403
        moved_to_own_private = client.patch(
            f"/api/v1/life/posts/{ids['post']}",
            headers=tokens["other"],
            json={"chapter_id": ids["own_target"]},
        )
        assert moved_to_own_private.status_code == 200

        with app.app_context():
            chapter = db.session.get(LifeChapter, ids["chapter"])
            chapter.review_status = "rejected"
            chapter.review_note = "旧意见"
            chapter.reviewed_by_id = user_ids[2]
            db.session.commit()
        resubmitted = client.patch(
            f"/api/v1/life/chapters/{ids['chapter']}",
            headers=tokens["owner"],
            json={"description": "重新提交"},
        )
        assert resubmitted.status_code == 200
        assert resubmitted.json["data"]["review_status"] == "pending"
        assert resubmitted.json["data"]["review_note"] is None
    finally:
        with app.app_context():
            _cleanup(user_ids)


def test_safe_delete_promotes_children_and_merges_posts_without_deleting_them(
    app, client, tmp_path
):
    marker = uuid.uuid4().hex[:8]
    app.config["UPLOAD_ROOT"] = tmp_path
    with app.app_context():
        owner = _user(marker, "o")
        other = _user(marker, "u")
        db.session.add_all([owner, other])
        db.session.flush()
        empty = _chapter(marker, "empty", owner)
        source = _chapter(marker, "source", owner)
        target = _chapter(marker, "target", owner)
        private_other = _chapter(
            marker,
            "foreign",
            other,
            contribution_policy="private",
        )
        db.session.add_all([empty, source, target, private_other])
        db.session.flush()
        child = _chapter(
            marker,
            "child",
            owner,
            parent_id=empty.id,
            dedupe_key=f"{empty.id}:child{marker}",
            chapter_type="scenic",
        )
        db.session.add(child)
        post = LifePost(
            author_id=other.id,
            chapter_id=source.id,
            title="不能误删",
            tags=[],
        )
        db.session.add(post)
        db.session.flush()
        rollback_blocker = Notification(
            recipient_id=other.id,
            actor_id=owner.id,
            notification_type="system",
            payload={"message": "制造迁移通知唯一键冲突"},
            dedupe_key=(
                f"chapter-migration:{source.id}:{target.id}:{other.id}"
            ),
        )
        db.session.add(rollback_blocker)
        db.session.commit()
        ids = {
            "empty": empty.id,
            "child": child.id,
            "source": source.id,
            "target": target.id,
            "foreign": private_other.id,
            "post": post.id,
            "rollback_blocker": rollback_blocker.id,
        }
        source_slug = source.slug
        user_ids = [owner.id, other.id]
        owner_headers = _headers(owner)
    try:
        preview = client.get(
            f"/api/v1/life/chapters/{ids['source']}/deletion-preview",
            headers=owner_headers,
        )
        assert preview.status_code == 200
        assert preview.json["data"]["post_count"] == 1
        assert preview.json["data"]["other_author_post_count"] == 1
        assert preview.json["data"]["requires_target"] is True

        promoted = client.post(
            f"/api/v1/life/chapters/{ids['empty']}/delete",
            headers=owner_headers,
            json={"confirmation_name": f"empty-{marker}"},
        )
        assert promoted.status_code == 200
        assert promoted.json["data"]["mode"] == "hard_deleted"
        with app.app_context():
            assert db.session.get(LifeChapter, ids["empty"]) is None
            assert db.session.get(LifeChapter, ids["child"]).parent_id is None

        illegal_target = client.post(
            f"/api/v1/life/chapters/{ids['source']}/delete",
            headers=owner_headers,
            json={
                "confirmation_name": f"source-{marker}",
                "target_chapter_id": ids["foreign"],
            },
        )
        assert illegal_target.status_code == 409
        rolled_back = client.post(
            f"/api/v1/life/chapters/{ids['source']}/delete",
            headers=owner_headers,
            json={
                "confirmation_name": f"source-{marker}",
                "target_chapter_id": ids["target"],
            },
        )
        assert rolled_back.status_code == 409
        with app.app_context():
            assert db.session.get(LifePost, ids["post"]).chapter_id == ids["source"]
            assert db.session.get(LifeChapter, ids["source"]).status == "active"
            db.session.delete(
                db.session.get(Notification, ids["rollback_blocker"])
            )
            db.session.commit()
        merged = client.post(
            f"/api/v1/life/chapters/{ids['source']}/delete",
            headers=owner_headers,
            json={
                "confirmation_name": f"source-{marker}",
                "target_chapter_id": ids["target"],
            },
        )
        assert merged.status_code == 200
        assert merged.json["data"]["mode"] == "merged"
        with app.app_context():
            assert db.session.get(LifePost, ids["post"]).chapter_id == ids["target"]
            assert db.session.get(LifeChapter, ids["source"]).status == "merged"
            assert db.session.scalar(
                db.select(Notification).where(
                    Notification.recipient_id == user_ids[1],
                    Notification.dedupe_key.like("chapter-migration:%"),
                )
            )
        canonical = client.get(f"/api/v1/life/chapters/{source_slug}")
        assert canonical.status_code == 200
        assert canonical.json["data"]["canonical_slug"] == f"target-{marker}"
        managed_merged = client.get(
            f"/api/v1/users/me/chapters/{ids['source']}",
            headers=owner_headers,
        )
        assert managed_merged.status_code == 200
        assert managed_merged.json["data"]["status"] == "merged"
        assert managed_merged.json["data"]["can_edit"] is False
        assert managed_merged.json["data"]["merged_into"]["id"] == ids["target"]
    finally:
        with app.app_context():
            _cleanup(user_ids)


def test_system_admin_force_delete_is_confirmed_and_idempotent(
    app, client, tmp_path
):
    marker = uuid.uuid4().hex[:8]
    app.config["UPLOAD_ROOT"] = tmp_path
    with app.app_context():
        owner = _user(marker, "o")
        system = _user(marker, "s", "system_admin")
        db.session.add_all([owner, system])
        db.session.flush()
        chapter = _chapter(marker, "force", owner)
        db.session.add(chapter)
        db.session.flush()
        child = _chapter(
            marker,
            "force-child",
            owner,
            parent_id=chapter.id,
            dedupe_key=f"{chapter.id}:forcechild{marker}",
        )
        db.session.add(child)
        db.session.flush()
        child_cover = _media(
            app,
            owner,
            f"{marker}-force-child-cover",
            bound_type="life_chapter_cover",
            bound_id=child.id,
        )
        child.cover_media_id = child_cover.id
        media = _media(
            app,
            owner,
            f"{marker}-force",
            bound_type="life_post",
        )
        post = LifePost(
            author_id=owner.id,
            chapter_id=chapter.id,
            title="级联删除",
            tags=[],
        )
        db.session.add(post)
        db.session.flush()
        media.bound_id = post.id
        db.session.add(
            LifePostMedia(post_id=post.id, media_id=media.id, position=0)
        )
        child_media = _media(
            app,
            owner,
            f"{marker}-force-child-post",
            bound_type="life_post",
        )
        child_post = LifePost(
            author_id=owner.id,
            chapter_id=child.id,
            title="子章节级联删除",
            tags=[],
        )
        db.session.add(child_post)
        db.session.flush()
        child_media.bound_id = child_post.id
        db.session.add(
            LifePostMedia(
                post_id=child_post.id,
                media_id=child_media.id,
                position=0,
            )
        )
        db.session.add_all(
            [
                ContentLike(
                    user_id=system.id,
                    target_type="life_post",
                    target_id=post.id,
                ),
                ContentFavorite(
                    user_id=system.id,
                    target_type="life_post",
                    target_id=post.id,
                ),
                Comment(
                    target_type="life_post",
                    target_id=post.id,
                    author_id=system.id,
                    body="会被清理的评论",
                ),
                FeaturedContent(
                    target_type="life_post",
                    target_id=post.id,
                    featured_by_id=system.id,
                ),
                Report(
                    reporter_id=system.id,
                    target_type="life_post",
                    target_id=post.id,
                    reason="other",
                    description="会被清理的举报",
                    target_snapshot={"title": post.title},
                ),
                Notification(
                    recipient_id=owner.id,
                    actor_id=system.id,
                    notification_type="content_hidden",
                    target_type="life_post",
                    target_id=post.id,
                    payload={"message": "旧通知"},
                ),
            ]
        )
        db.session.commit()
        chapter_id, post_id, media_id = chapter.id, post.id, media.id
        child_id, child_post_id = child.id, child_post.id
        child_media_ids = [child_cover.id, child_media.id]
        user_ids = [owner.id, system.id]
        headers = _headers(system)
        idempotency_key = str(uuid.uuid4())
        headers["Idempotency-Key"] = idempotency_key
    try:
        preview = client.get(
            f"/api/v1/admin/chapters/{chapter_id}/deletion-preview",
            headers=headers,
        )
        assert preview.status_code == 200
        assert preview.json["data"]["force_delete_post_count"] == 2
        assert preview.json["data"]["force_delete_child_count"] == 1
        assert preview.json["data"]["force_delete_image_count"] == 3
        bad = client.post(
            f"/api/v1/admin/chapters/{chapter_id}/force-delete",
            headers=headers,
            json={
                "reason": "测试高风险确认",
                "confirmation": "DELETE",
                "cascade_posts": True,
                "cascade_children": True,
            },
        )
        assert bad.status_code == 422
        payload = {
            "reason": "测试高风险确认",
            "confirmation": f"DELETE CHAPTER {chapter_id}",
            "cascade_posts": True,
            "cascade_children": True,
        }
        deleted = client.post(
            f"/api/v1/admin/chapters/{chapter_id}/force-delete",
            headers=headers,
            json=payload,
        )
        assert deleted.status_code == 200
        assert deleted.json["data"]["deleted_post_count"] == 2
        assert deleted.json["data"]["deleted_child_count"] == 1
        assert deleted.json["data"]["deleted_image_count"] == 3
        retried = client.post(
            f"/api/v1/admin/chapters/{chapter_id}/force-delete",
            headers=headers,
            json=payload,
        )
        assert retried.status_code == 200
        assert retried.json["data"]["already_processed"] is True
        with app.app_context():
            assert db.session.get(LifeChapter, chapter_id) is None
            assert db.session.get(LifeChapter, child_id) is None
            assert db.session.get(LifePost, post_id) is None
            assert db.session.get(LifePost, child_post_id) is None
            assert not db.session.scalar(
                db.select(Comment.id).where(
                    Comment.target_type == "life_post",
                    Comment.target_id == post_id,
                )
            )
            assert not db.session.scalar(
                db.select(Report.id).where(
                    Report.target_type == "life_post",
                    Report.target_id == post_id,
                )
            )
            assert not db.session.scalar(
                db.select(FeaturedContent.id).where(
                    FeaturedContent.target_type == "life_post",
                    FeaturedContent.target_id == post_id,
                )
            )
            assert not db.session.scalar(
                db.select(Media.id).where(Media.id == media_id)
            )
            assert not db.session.scalar(
                db.select(Media.id).where(Media.id.in_(child_media_ids))
            )
            assert db.session.scalar(
                db.select(AdminLog).where(
                    AdminLog.idempotency_key == idempotency_key
                )
            )
    finally:
        with app.app_context():
            _cleanup(user_ids)


def test_edit_hierarchy_conflicts_roles_and_merged_state(app, client):
    marker = uuid.uuid4().hex[:8]
    with app.app_context():
        owner = _user(marker, "o")
        other = _user(marker, "u")
        content_admin = _user(marker, "c", "content_admin")
        system_admin = _user(marker, "s", "system_admin")
        db.session.add_all([owner, other, content_admin, system_admin])
        db.session.flush()
        root = _chapter(marker, "root", owner)
        destination = _chapter(marker, "destination", other)
        merged = _chapter(marker, "merged", owner, status="merged")
        db.session.add_all([root, destination, merged])
        db.session.flush()
        child = _chapter(
            marker,
            "child",
            owner,
            parent_id=root.id,
            dedupe_key=f"{root.id}:child{marker}",
        )
        sibling = _chapter(
            marker,
            "sibling",
            owner,
            parent_id=root.id,
            dedupe_key=f"{root.id}:sibling{marker}",
        )
        destination_child = _chapter(
            marker,
            "destination-child",
            other,
            parent_id=destination.id,
            dedupe_key=f"{destination.id}:destinationchild{marker}",
        )
        db.session.add_all([child, sibling, destination_child])
        db.session.commit()
        ids = {
            "root": root.id,
            "child": child.id,
            "sibling": sibling.id,
            "destination": destination.id,
            "destination_child": destination_child.id,
            "merged": merged.id,
        }
        root_slug = root.slug
        user_ids = [owner.id, other.id, content_admin.id, system_admin.id]
        headers = {
            "owner": _headers(owner),
            "other": _headers(other),
            "content": _headers(content_admin),
            "system": _headers(system_admin),
        }
    try:
        switched = client.patch(
            f"/api/v1/life/chapters/{ids['root']}",
            headers=headers["owner"],
            json={"contribution_policy": "private"},
        )
        assert switched.status_code == 200
        assert switched.json["data"]["slug"] == root_slug
        assert switched.json["data"]["contribution_policy"] == "private"
        assert client.patch(
            f"/api/v1/life/chapters/{ids['root']}",
            headers=headers["other"],
            json={"description": "越权"},
        ).status_code == 403
        assert client.patch(
            f"/api/v1/admin/chapters/{ids['root']}",
            headers=headers["content"],
            json={"description": "内容管理员可编辑"},
        ).status_code == 200
        assert client.patch(
            f"/api/v1/admin/chapters/{ids['root']}",
            headers=headers["system"],
            json={"description": "系统管理员可编辑"},
        ).status_code == 200

        has_children = client.patch(
            f"/api/v1/life/chapters/{ids['root']}",
            headers=headers["owner"],
            json={"parent_id": ids["destination"]},
        )
        assert has_children.status_code == 422
        cycle = client.patch(
            f"/api/v1/life/chapters/{ids['child']}",
            headers=headers["owner"],
            json={"parent_id": ids["child"]},
        )
        assert cycle.status_code == 422
        third_level = client.patch(
            f"/api/v1/life/chapters/{ids['child']}",
            headers=headers["owner"],
            json={"parent_id": ids["destination_child"]},
        )
        assert third_level.status_code == 422
        duplicate = client.patch(
            f"/api/v1/life/chapters/{ids['child']}",
            headers=headers["owner"],
            json={"name": f"sibling-{marker}"},
        )
        assert duplicate.status_code == 409
        assert client.patch(
            f"/api/v1/life/chapters/{ids['merged']}",
            headers=headers["owner"],
            json={"description": "不能编辑"},
        ).status_code == 409

        with app.app_context():
            db.session.get(LifeChapter, ids["child"]).status = "disabled"
            db.session.commit()
        disabled_edit = client.patch(
            f"/api/v1/life/chapters/{ids['child']}",
            headers=headers["owner"],
            json={"description": "禁用状态仍可编辑内容"},
        )
        assert disabled_edit.status_code == 200
        assert disabled_edit.json["data"]["status"] == "disabled"
    finally:
        with app.app_context():
            _cleanup(user_ids)


def test_delete_authorization_conflicts_and_admin_reason(app, client):
    marker = uuid.uuid4().hex[:8]
    with app.app_context():
        owner = _user(marker, "o")
        other = _user(marker, "u")
        admin = _user(marker, "a", "content_admin")
        db.session.add_all([owner, other, admin])
        db.session.flush()
        source = _chapter(marker, "promote", owner)
        conflict = _chapter(marker, "same", owner)
        owner_empty = _chapter(marker, "owner-empty", owner)
        admin_empty = _chapter(marker, "admin-empty", owner)
        post_source = _chapter(marker, "post-source", owner)
        own_private = _chapter(
            marker,
            "own-private",
            owner,
            contribution_policy="private",
        )
        db.session.add_all(
            [
                source,
                conflict,
                owner_empty,
                admin_empty,
                post_source,
                own_private,
            ]
        )
        db.session.flush()
        child = _chapter(
            marker,
            "same",
            owner,
            parent_id=source.id,
            dedupe_key=f"{source.id}:same{marker}",
            slug=f"same-child-{marker}",
        )
        post = LifePost(
            author_id=other.id,
            chapter_id=post_source.id,
            title="必须迁移",
            tags=[],
        )
        db.session.add_all([child, post])
        db.session.commit()
        ids = {
            "source": source.id,
            "owner_empty": owner_empty.id,
            "admin_empty": admin_empty.id,
            "post_source": post_source.id,
            "private": own_private.id,
            "post": post.id,
        }
        user_ids = [owner.id, other.id, admin.id]
        headers = {
            "owner": _headers(owner),
            "other": _headers(other),
            "admin": _headers(admin),
        }
    try:
        owner_deleted = client.post(
            f"/api/v1/life/chapters/{ids['owner_empty']}/delete",
            headers=headers["owner"],
            json={"confirmation_name": f"owner-empty-{marker}"},
        )
        assert owner_deleted.status_code == 200
        assert owner_deleted.json["data"]["mode"] == "hard_deleted"
        assert client.get(
            f"/api/v1/life/chapters/{ids['source']}/deletion-preview",
            headers=headers["other"],
        ).status_code == 403
        assert client.post(
            f"/api/v1/life/chapters/{ids['source']}/delete",
            headers=headers["other"],
            json={"confirmation_name": f"promote-{marker}"},
        ).status_code == 403
        conflict_response = client.post(
            f"/api/v1/life/chapters/{ids['source']}/delete",
            headers=headers["owner"],
            json={"confirmation_name": f"promote-{marker}"},
        )
        assert conflict_response.status_code == 409
        assert conflict_response.json["error"]["details"][0]["chapter_name"] == f"same-{marker}"

        missing_reason = client.post(
            f"/api/v1/admin/chapters/{ids['admin_empty']}/delete",
            headers=headers["admin"],
            json={"confirmation_name": f"admin-empty-{marker}"},
        )
        assert missing_reason.status_code == 422
        admin_deleted = client.post(
            f"/api/v1/admin/chapters/{ids['admin_empty']}/delete",
            headers=headers["admin"],
            json={
                "confirmation_name": f"admin-empty-{marker}",
                "reason": "清理无内容章节",
            },
        )
        assert admin_deleted.status_code == 200

        missing_target = client.post(
            f"/api/v1/life/chapters/{ids['post_source']}/delete",
            headers=headers["owner"],
            json={"confirmation_name": f"post-source-{marker}"},
        )
        assert missing_target.status_code == 409
        merged = client.post(
            f"/api/v1/life/chapters/{ids['post_source']}/delete",
            headers=headers["owner"],
            json={
                "confirmation_name": f"post-source-{marker}",
                "target_chapter_id": ids["private"],
            },
        )
        assert merged.status_code == 200
        with app.app_context():
            assert db.session.get(LifePost, ids["post"]).chapter_id == ids["private"]
    finally:
        with app.app_context():
            _cleanup(user_ids)


def test_cover_rollback_and_file_cleanup_failure_are_safe(
    app, client, tmp_path, monkeypatch
):
    marker = uuid.uuid4().hex[:8]
    app.config["UPLOAD_ROOT"] = tmp_path
    with app.app_context():
        owner = _user(marker, "o")
        db.session.add(owner)
        db.session.flush()
        chapter = _chapter(marker, "cover", owner)
        db.session.add(chapter)
        db.session.flush()
        old_cover = _media(
            app,
            owner,
            f"{marker}-old",
            bound_type="life_chapter_cover",
            bound_id=chapter.id,
        )
        chapter.cover_media_id = old_cover.id
        replacement = _media(app, owner, f"{marker}-replacement")
        incomplete = _media(app, owner, f"{marker}-incomplete")
        db.session.commit()
        incomplete_thumbnail = (
            Path(app.config["UPLOAD_ROOT"]) / incomplete.thumbnail_key
        )
        incomplete_thumbnail.unlink()
        old_file = Path(app.config["UPLOAD_ROOT"]) / old_cover.storage_key
        ids = {
            "chapter": chapter.id,
            "old": old_cover.id,
            "replacement": replacement.id,
            "incomplete": incomplete.id,
        }
        user_ids = [owner.id]
        headers = _headers(owner)
    try:
        incomplete_response = client.patch(
            f"/api/v1/life/chapters/{ids['chapter']}",
            headers=headers,
            json={"cover_media_id": ids["incomplete"]},
        )
        assert incomplete_response.status_code == 409

        session_class = type(db.session())
        with monkeypatch.context() as patch:
            def fail_commit(_session):
                raise RuntimeError("simulated commit failure")

            patch.setattr(session_class, "commit", fail_commit)
            failed = client.patch(
                f"/api/v1/life/chapters/{ids['chapter']}",
                headers=headers,
                json={"cover_media_id": ids["replacement"]},
            )
            assert failed.status_code == 500
        with app.app_context():
            db.session.remove()
            chapter = db.session.get(LifeChapter, ids["chapter"])
            assert chapter.cover_media_id == ids["old"]
            assert db.session.get(Media, ids["old"]) is not None
            assert db.session.get(Media, ids["replacement"]).is_bound is False
            assert old_file.exists()

        with monkeypatch.context() as patch:
            patch.setattr(
                "app.life.chapter_service.remove_media_files",
                lambda _media: (_ for _ in ()).throw(OSError("cleanup failed")),
            )
            saved = client.patch(
                f"/api/v1/life/chapters/{ids['chapter']}",
                headers=headers,
                json={"cover_media_id": ids["replacement"]},
            )
            assert saved.status_code == 200
        with app.app_context():
            db.session.remove()
            assert db.session.get(LifeChapter, ids["chapter"]).cover_media_id == ids["replacement"]
            assert db.session.get(Media, ids["old"]) is None
            assert old_file.exists()
    finally:
        with app.app_context():
            _cleanup(user_ids)
