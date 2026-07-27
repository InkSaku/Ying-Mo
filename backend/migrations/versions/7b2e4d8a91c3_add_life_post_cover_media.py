"""add explicit life post cover media

Revision ID: 7b2e4d8a91c3
Revises: 3e7f1a9c2b64
"""
from alembic import op
import sqlalchemy as sa


revision = "7b2e4d8a91c3"
down_revision = "3e7f1a9c2b64"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("life_posts") as batch:
        batch.add_column(
            sa.Column("cover_media_id", sa.Integer(), nullable=True)
        )
        batch.create_index(
            "ix_life_posts_cover_media_id",
            ["cover_media_id"],
            unique=False,
        )
        batch.create_foreign_key(
            "fk_life_posts_cover_media_id_media",
            "media",
            ["cover_media_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade():
    with op.batch_alter_table("life_posts") as batch:
        batch.drop_constraint(
            "fk_life_posts_cover_media_id_media",
            type_="foreignkey",
        )
        batch.drop_index("ix_life_posts_cover_media_id")
        batch.drop_column("cover_media_id")
