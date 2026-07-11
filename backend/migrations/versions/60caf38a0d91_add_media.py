"""add media

Revision ID: 60caf38a0d91
Revises: 931431f77f5d
Create Date: 2026-07-11 21:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "60caf38a0d91"
down_revision = "931431f77f5d"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "media",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("public_id", sa.String(length=36), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("purpose", sa.String(length=20), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("thumbnail_key", sa.String(length=512), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("bound_type", sa.String(length=50), nullable=True),
        sa.Column("bound_id", sa.Integer(), nullable=True),
        sa.Column("bound_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("purpose IN ('avatar', 'content')", name="ck_media_purpose"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("media", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_media_public_id"), ["public_id"], unique=True)
        batch_op.create_index(batch_op.f("ix_media_owner_id"), ["owner_id"], unique=False)
        batch_op.create_index("ix_media_bound_type_bound_id", ["bound_type", "bound_id"], unique=False)


def downgrade():
    op.drop_table("media")
