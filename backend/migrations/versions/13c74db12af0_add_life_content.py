"""add life content

Revision ID: 13c74db12af0
Revises: 60caf38a0d91
"""
from alembic import op
import sqlalchemy as sa

revision = "13c74db12af0"
down_revision = "60caf38a0d91"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("life_chapters", sa.Column("id",sa.Integer(),primary_key=True), sa.Column("name",sa.String(80),nullable=False), sa.Column("normalized_name",sa.String(160),nullable=False), sa.Column("dedupe_key",sa.String(220),nullable=False), sa.Column("slug",sa.String(120),nullable=False), sa.Column("chapter_type",sa.String(20),nullable=False), sa.Column("parent_id",sa.Integer(),nullable=True), sa.Column("country",sa.String(100)), sa.Column("province",sa.String(100)), sa.Column("city",sa.String(100)), sa.Column("description",sa.String(500)), sa.Column("cover_media_id",sa.Integer()), sa.Column("creator_id",sa.Integer(),nullable=False), sa.Column("status",sa.String(20),nullable=False,server_default="active"), sa.Column("created_at",sa.DateTime(timezone=True),nullable=False), sa.Column("updated_at",sa.DateTime(timezone=True),nullable=False), sa.ForeignKeyConstraint(["parent_id"],["life_chapters.id"],ondelete="RESTRICT"), sa.ForeignKeyConstraint(["cover_media_id"],["media.id"],ondelete="SET NULL"), sa.ForeignKeyConstraint(["creator_id"],["users.id"],ondelete="RESTRICT"))
    with op.batch_alter_table("life_chapters") as b:
        b.create_index("ix_life_chapters_normalized_name",["normalized_name"]); b.create_index("ix_life_chapters_dedupe_key",["dedupe_key"],unique=True); b.create_index("ix_life_chapters_slug",["slug"],unique=True); b.create_index("ix_life_chapters_parent_id",["parent_id"]); b.create_index("ix_life_chapters_creator_id",["creator_id"]); b.create_index("ix_life_chapters_chapter_type",["chapter_type"]); b.create_index("ix_life_chapters_status",["status"])
    op.create_table("life_posts",sa.Column("id",sa.Integer(),primary_key=True),sa.Column("author_id",sa.Integer(),nullable=False),sa.Column("chapter_id",sa.Integer(),nullable=False),sa.Column("title",sa.String(100),nullable=False),sa.Column("body",sa.String(5000)),sa.Column("location",sa.String(100)),sa.Column("mood",sa.String(30)),sa.Column("tags",sa.JSON(),nullable=False),sa.Column("shot_at",sa.DateTime(timezone=True)),sa.Column("visibility",sa.String(20),nullable=False,server_default="public"),sa.Column("status",sa.String(20),nullable=False,server_default="published"),sa.Column("created_at",sa.DateTime(timezone=True),nullable=False),sa.Column("updated_at",sa.DateTime(timezone=True),nullable=False),sa.ForeignKeyConstraint(["author_id"],["users.id"],ondelete="CASCADE"),sa.ForeignKeyConstraint(["chapter_id"],["life_chapters.id"],ondelete="RESTRICT"))
    with op.batch_alter_table("life_posts") as b:
        b.create_index("ix_life_posts_chapter_created",["chapter_id","created_at"]); b.create_index("ix_life_posts_author_created",["author_id","created_at"]); b.create_index("ix_life_posts_visibility_created",["visibility","created_at"]); b.create_index("ix_life_posts_status_created",["status","created_at"])
    op.create_table("life_post_media",sa.Column("id",sa.Integer(),primary_key=True),sa.Column("post_id",sa.Integer(),nullable=False),sa.Column("media_id",sa.Integer(),nullable=False),sa.Column("position",sa.Integer(),nullable=False),sa.Column("created_at",sa.DateTime(timezone=True),nullable=False),sa.ForeignKeyConstraint(["post_id"],["life_posts.id"],ondelete="CASCADE"),sa.ForeignKeyConstraint(["media_id"],["media.id"],ondelete="RESTRICT"),sa.UniqueConstraint("media_id"),sa.UniqueConstraint("post_id","position",name="uq_life_post_media_position"))
    with op.batch_alter_table("life_post_media") as b: b.create_index("ix_life_post_media_post_id",["post_id"])

def downgrade():
    op.drop_table("life_post_media")
    op.drop_table("life_posts")
    op.drop_table("life_chapters")
