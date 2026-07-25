"""add live video media fields

Revision ID: f3b7a91d2c64
Revises: c8e4f2a1b907
"""
from alembic import op
import sqlalchemy as sa


revision = "f3b7a91d2c64"
down_revision = "c8e4f2a1b907"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "media",
        sa.Column("media_type", sa.String(length=20), nullable=False, server_default="image"),
    )
    op.add_column("media", sa.Column("duration_ms", sa.Integer(), nullable=True))
    op.add_column(
        "media",
        sa.Column("has_audio", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_media_media_type", "media", ["media_type"])
    op.create_check_constraint(
        "ck_media_type",
        "media",
        "media_type IN ('image', 'live_video')",
    )


def downgrade():
    op.drop_constraint("ck_media_type", "media", type_="check")
    op.drop_index("ix_media_media_type", table_name="media")
    op.drop_column("media", "has_audio")
    op.drop_column("media", "duration_ms")
    op.drop_column("media", "media_type")
