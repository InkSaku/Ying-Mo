"""add flexible life post content

Revision ID: 3e7f1a9c2b64
Revises: f3b7a91d2c64
"""
from alembic import op
import sqlalchemy as sa


revision = "3e7f1a9c2b64"
down_revision = "f3b7a91d2c64"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("life_posts") as batch:
        batch.alter_column(
            "title",
            existing_type=sa.String(length=100),
            nullable=True,
        )
        batch.alter_column(
            "body",
            existing_type=sa.String(length=5000),
            type_=sa.Text(),
            existing_nullable=True,
        )
        batch.add_column(
            sa.Column(
                "content_format",
                sa.String(length=20),
                nullable=False,
                server_default="plain",
            )
        )
        batch.add_column(
            sa.Column("external_video_url", sa.String(length=2048), nullable=True)
        )
        batch.create_check_constraint(
            "ck_life_posts_content_format",
            "content_format IN ('plain', 'markdown')",
        )


def downgrade():
    with op.batch_alter_table("life_posts") as batch:
        batch.drop_constraint("ck_life_posts_content_format", type_="check")
        batch.drop_column("external_video_url")
        batch.drop_column("content_format")
        batch.execute(
            sa.text(
                "UPDATE life_posts SET body = LEFT(body, 5000) "
                "WHERE CHAR_LENGTH(body) > 5000"
            )
        )
        batch.alter_column(
            "body",
            existing_type=sa.Text(),
            type_=sa.String(length=5000),
            existing_nullable=True,
        )
        batch.execute(
            sa.text(
                "UPDATE life_posts SET title = '未命名内容' "
                "WHERE title IS NULL OR TRIM(title) = ''"
            )
        )
        batch.alter_column(
            "title",
            existing_type=sa.String(length=100),
            nullable=False,
        )
