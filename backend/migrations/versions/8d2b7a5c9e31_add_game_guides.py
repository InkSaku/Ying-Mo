"""add game guides

Revision ID: 8d2b7a5c9e31
Revises: 4f8c2c1a7d90
"""
from alembic import op
import sqlalchemy as sa

revision = "8d2b7a5c9e31"
down_revision = "4f8c2c1a7d90"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("game_guides", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("author_id", sa.Integer(), nullable=False), sa.Column("game_id", sa.Integer(), nullable=False), sa.Column("hero_id", sa.Integer()), sa.Column("map_id", sa.Integer()), sa.Column("guide_scope", sa.String(20), nullable=False), sa.Column("title", sa.String(120), nullable=False), sa.Column("category", sa.String(40), nullable=False), sa.Column("instructions", sa.Text(), nullable=False), sa.Column("map_area", sa.String(120)), sa.Column("side", sa.String(20)), sa.Column("skill", sa.String(120)), sa.Column("aim_reference", sa.String(500)), sa.Column("timing", sa.String(500)), sa.Column("difficulty", sa.String(20)), sa.Column("game_version", sa.String(50)), sa.Column("tags", sa.JSON(), nullable=False), sa.Column("notes", sa.Text()), sa.Column("video_url", sa.String(1000)), sa.Column("search_text", sa.Text(), nullable=False), sa.Column("validity_status", sa.String(30), nullable=False, server_default="unverified"), sa.Column("tested_at", sa.Date()), sa.Column("validity_note", sa.String(1000)), sa.Column("last_confirmed_at", sa.DateTime(timezone=True)), sa.Column("status", sa.String(20), nullable=False, server_default="published"), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False), sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="RESTRICT"), sa.ForeignKeyConstraint(["game_id"], ["games.id"], ondelete="RESTRICT"), sa.ForeignKeyConstraint(["hero_id"], ["game_heroes.id"], ondelete="RESTRICT"), sa.ForeignKeyConstraint(["map_id"], ["game_maps.id"], ondelete="RESTRICT"), sa.CheckConstraint("guide_scope IN ('game', 'hero', 'map', 'hero_map')", name="ck_game_guides_scope"), sa.CheckConstraint("category IN ('skill_position', 'turret_position', 'grenade_throw', 'detonator_throw', 'hold_angle', 'defense_position', 'attack_route', 'opening_tip', 'energy_gain', 'team_composition', 'map_mechanic', 'other')", name="ck_game_guides_category"), sa.CheckConstraint("side IN ('attack', 'defense', 'both') OR side IS NULL", name="ck_game_guides_side"), sa.CheckConstraint("difficulty IN ('beginner', 'intermediate', 'advanced') OR difficulty IS NULL", name="ck_game_guides_difficulty"), sa.CheckConstraint("validity_status IN ('unverified', 'valid', 'possibly_invalid', 'invalid')", name="ck_game_guides_validity"), sa.CheckConstraint("status IN ('published', 'hidden')", name="ck_game_guides_status"))
    for name, cols in (("ix_game_guides_game_created", ["game_id", "created_at"]), ("ix_game_guides_hero_created", ["hero_id", "created_at"]), ("ix_game_guides_map_created", ["map_id", "created_at"]), ("ix_game_guides_author_created", ["author_id", "created_at"]), ("ix_game_guides_status_created", ["status", "created_at"]), ("ix_game_guides_category", ["category"]), ("ix_game_guides_difficulty", ["difficulty"]), ("ix_game_guides_validity_status", ["validity_status"]), ("ix_game_guides_game_version", ["game_version"])): op.create_index(name, "game_guides", cols)
    op.create_table("game_guide_steps", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("guide_id", sa.Integer(), nullable=False), sa.Column("media_id", sa.Integer(), nullable=False), sa.Column("position", sa.Integer(), nullable=False), sa.Column("title", sa.String(120), nullable=False), sa.Column("description", sa.String(3000), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False), sa.ForeignKeyConstraint(["guide_id"], ["game_guides.id"], ondelete="CASCADE"), sa.ForeignKeyConstraint(["media_id"], ["media.id"], ondelete="RESTRICT"), sa.UniqueConstraint("media_id", name="uq_game_guide_steps_media"), sa.UniqueConstraint("guide_id", "position", name="uq_game_guide_steps_position"), sa.CheckConstraint("position >= 0", name="ck_game_guide_steps_position"))
    op.create_index("ix_game_guide_steps_guide_id", "game_guide_steps", ["guide_id"])

def downgrade():
    op.drop_table("game_guide_steps")
    op.drop_table("game_guides")
