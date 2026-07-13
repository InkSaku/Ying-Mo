"""add interactions and notifications

Revision ID: c4a91e7b2d63
Revises: 8d2b7a5c9e31
"""
from alembic import op
import sqlalchemy as sa

revision = "c4a91e7b2d63"
down_revision = "8d2b7a5c9e31"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("content_likes", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), nullable=False), sa.Column("target_type", sa.String(30), nullable=False), sa.Column("target_id", sa.Integer(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.CheckConstraint("target_type IN ('life_post', 'game_guide')", name="ck_content_likes_target_type"), sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"), sa.UniqueConstraint("user_id", "target_type", "target_id", name="uq_content_likes_user_target"))
    op.create_index("ix_content_likes_target", "content_likes", ["target_type", "target_id"]); op.create_index("ix_content_likes_user_created", "content_likes", ["user_id", "created_at"]); op.create_index("ix_content_likes_target_created", "content_likes", ["target_type", "target_id", "created_at"])
    op.create_table("content_favorites", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("user_id", sa.Integer(), nullable=False), sa.Column("target_type", sa.String(30), nullable=False), sa.Column("target_id", sa.Integer(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.CheckConstraint("target_type IN ('life_post', 'game_guide')", name="ck_content_favorites_target_type"), sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"), sa.UniqueConstraint("user_id", "target_type", "target_id", name="uq_content_favorites_user_target"))
    op.create_index("ix_content_favorites_target", "content_favorites", ["target_type", "target_id"]); op.create_index("ix_content_favorites_user_created", "content_favorites", ["user_id", "created_at"])
    op.create_table("comments", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("target_type", sa.String(30), nullable=False), sa.Column("target_id", sa.Integer(), nullable=False), sa.Column("author_id", sa.Integer(), nullable=False), sa.Column("parent_id", sa.Integer()), sa.Column("reply_to_comment_id", sa.Integer()), sa.Column("reply_to_user_id", sa.Integer()), sa.Column("body", sa.String(500)), sa.Column("status", sa.String(20), nullable=False, server_default="active"), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False), sa.Column("deleted_at", sa.DateTime(timezone=True)), sa.CheckConstraint("target_type IN ('life_post', 'game_guide')", name="ck_comments_target_type"), sa.CheckConstraint("status IN ('active', 'deleted', 'hidden')", name="ck_comments_status"), sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="RESTRICT"), sa.ForeignKeyConstraint(["parent_id"], ["comments.id"], ondelete="CASCADE"), sa.ForeignKeyConstraint(["reply_to_comment_id"], ["comments.id"], ondelete="SET NULL"), sa.ForeignKeyConstraint(["reply_to_user_id"], ["users.id"], ondelete="SET NULL"))
    for name, cols in (("ix_comments_target_created", ["target_type","target_id","created_at"]),("ix_comments_target_parent_created",["target_type","target_id","parent_id","created_at"]),("ix_comments_author_created",["author_id","created_at"]),("ix_comments_parent_created",["parent_id","created_at"]),("ix_comments_status_created",["status","created_at"])): op.create_index(name, "comments", cols)
    op.create_table("notifications", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("recipient_id", sa.Integer(), nullable=False), sa.Column("actor_id", sa.Integer()), sa.Column("notification_type", sa.String(30), nullable=False), sa.Column("target_type", sa.String(30)), sa.Column("target_id", sa.Integer()), sa.Column("comment_id", sa.Integer()), sa.Column("dedupe_key", sa.String(255), unique=True), sa.Column("payload", sa.JSON(), nullable=False), sa.Column("read_at", sa.DateTime(timezone=True)), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.CheckConstraint("notification_type IN ('like','comment','reply','chapter_review','content_hidden','report_result','system')", name="ck_notifications_type"), sa.CheckConstraint("target_type IS NULL OR target_type IN ('life_post', 'game_guide')", name="ck_notifications_target_type"), sa.ForeignKeyConstraint(["recipient_id"], ["users.id"], ondelete="CASCADE"), sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"), sa.ForeignKeyConstraint(["comment_id"], ["comments.id"], ondelete="SET NULL"))
    for name, cols in (("ix_notifications_recipient_created",["recipient_id","created_at"]),("ix_notifications_recipient_read_created",["recipient_id","read_at","created_at"]),("ix_notifications_target",["target_type","target_id"]),("ix_notifications_comment",["comment_id"])): op.create_index(name, "notifications", cols)


def downgrade():
    op.drop_table("notifications"); op.drop_table("comments"); op.drop_table("content_favorites"); op.drop_table("content_likes")
