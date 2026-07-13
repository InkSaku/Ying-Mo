"""add content drafts

Revision ID: e5f4b3a2917d
Revises: c4a91e7b2d63
"""
from alembic import op
import sqlalchemy as sa


revision = "e5f4b3a2917d"
down_revision = "c4a91e7b2d63"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "content_drafts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("draft_type", sa.String(30), nullable=False),
        sa.Column("title_cache", sa.String(120)),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("draft_type IN ('life_post', 'game_guide')", name="ck_content_drafts_type"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_content_drafts_owner_updated", "content_drafts", ["owner_id", "updated_at"])
    op.create_index("ix_content_drafts_owner_type_updated", "content_drafts", ["owner_id", "draft_type", "updated_at"])
    op.create_table(
        "content_draft_media",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("draft_id", sa.Integer(), nullable=False),
        sa.Column("media_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("position >= 0", name="ck_content_draft_media_position"),
        sa.ForeignKeyConstraint(["draft_id"], ["content_drafts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["media_id"], ["media.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("media_id", name="uq_content_draft_media_media"),
        sa.UniqueConstraint("draft_id", "position", name="uq_content_draft_media_position"),
    )


def downgrade():
    op.drop_table("content_draft_media")
    op.drop_table("content_drafts")
