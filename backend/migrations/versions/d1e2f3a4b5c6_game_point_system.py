"""migrate game guides to the map-first point system

Revision ID: d1e2f3a4b5c6
Revises: 9b4e6f2a8c10
Create Date: 2026-07-21

The migration deliberately keeps legacy guides.  Records that cannot be safely
associated with both a map and a hero are hidden, never deleted or guessed.
"""

from alembic import op
import sqlalchemy as sa


revision = "d1e2f3a4b5c6"
down_revision = "9b4e6f2a8c10"
branch_labels = None
depends_on = None


OLD_CATEGORY = "'skill_position', 'turret_position', 'grenade_throw', 'detonator_throw', 'hold_angle', 'defense_position', 'attack_route', 'opening_tip', 'energy_gain', 'team_composition', 'map_mechanic', 'other'"
NEW_CATEGORY = "'deployment_position', 'skill_throw', 'timed_throw', 'hold_position', 'movement_route', 'map_interaction', 'other'"


def upgrade():
    # Preserve incomplete historical guides while making them unavailable to the
    # new public map + hero path. No inferred map or hero is ever written.
    op.execute("UPDATE game_guides SET status = 'hidden' WHERE guide_scope <> 'hero_map' OR hero_id IS NULL OR map_id IS NULL")
    op.execute("""
        UPDATE game_guides SET category = CASE category
          WHEN 'turret_position' THEN 'deployment_position'
          WHEN 'grenade_throw' THEN 'skill_throw'
          WHEN 'detonator_throw' THEN 'skill_throw'
          WHEN 'hold_angle' THEN 'hold_position'
          WHEN 'defense_position' THEN 'hold_position'
          WHEN 'attack_route' THEN 'movement_route'
          WHEN 'map_mechanic' THEN 'map_interaction'
          ELSE 'other'
        END
    """)
    with op.batch_alter_table("game_guides") as batch:
        batch.add_column(sa.Column("content_mode", sa.String(length=16), nullable=False, server_default="simple"))
        batch.drop_constraint("ck_game_guides_category", type_="check")
        batch.create_check_constraint("ck_game_guides_category", f"category IN ({NEW_CATEGORY})")
        batch.create_check_constraint("ck_game_guides_content_mode", "content_mode IN ('simple', 'steps')")
        batch.create_index("ix_game_guides_game_map_hero_updated", ["game_id", "map_id", "hero_id", "updated_at"])
    with op.batch_alter_table("game_guide_steps") as batch:
        batch.alter_column("title", existing_type=sa.String(length=120), nullable=True)
        batch.alter_column("description", existing_type=sa.String(length=3000), nullable=True)
    op.create_table(
        "guide_validity_feedback",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("guide_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("feedback_type", sa.String(length=30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("feedback_type IN ('valid', 'possibly_invalid')", name="ck_guide_validity_feedback_type"),
        sa.ForeignKeyConstraint(["guide_id"], ["game_guides.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("guide_id", "user_id", name="uq_guide_validity_feedback_guide_user"),
    )
    op.create_index("ix_guide_validity_feedback_guide_type", "guide_validity_feedback", ["guide_id", "feedback_type"])
    with op.batch_alter_table("notifications") as batch:
        batch.drop_constraint("ck_notifications_type", type_="check")
        batch.create_check_constraint("ck_notifications_type", "notification_type IN ('like','comment','reply','chapter_review','content_hidden','report_result','guide_validity_feedback','guide_validity_changed','system')")
    with op.batch_alter_table("reports") as batch:
        batch.drop_constraint("ck_reports_reason", type_="check")
        batch.create_check_constraint("ck_reports_reason", "reason IN ('inappropriate', 'violence_illegal', 'harassment', 'spam', 'plagiarism', 'incorrect_tutorial', 'guide_outdated', 'wrong_map_or_hero', 'duplicate', 'other')")


def downgrade():
    with op.batch_alter_table("reports") as batch:
        batch.drop_constraint("ck_reports_reason", type_="check")
        batch.create_check_constraint("ck_reports_reason", "reason IN ('inappropriate', 'violence_illegal', 'harassment', 'spam', 'plagiarism', 'incorrect_tutorial', 'duplicate', 'other')")
    with op.batch_alter_table("notifications") as batch:
        batch.drop_constraint("ck_notifications_type", type_="check")
        batch.create_check_constraint("ck_notifications_type", "notification_type IN ('like','comment','reply','chapter_review','content_hidden','report_result','system')")
    op.drop_index("ix_guide_validity_feedback_guide_type", table_name="guide_validity_feedback")
    op.drop_table("guide_validity_feedback")
    # Deterministic reverse mapping keeps migrated content rather than deleting it.
    op.execute("""
        UPDATE game_guides SET category = CASE category
          WHEN 'deployment_position' THEN 'turret_position'
          WHEN 'skill_throw' THEN 'grenade_throw'
          WHEN 'hold_position' THEN 'hold_angle'
          WHEN 'movement_route' THEN 'attack_route'
          WHEN 'map_interaction' THEN 'map_mechanic'
          ELSE 'other'
        END
    """)
    with op.batch_alter_table("game_guide_steps") as batch:
        batch.alter_column("title", existing_type=sa.String(length=120), nullable=False, server_default="")
        batch.alter_column("description", existing_type=sa.String(length=3000), nullable=False, server_default="")
    with op.batch_alter_table("game_guides") as batch:
        batch.drop_index("ix_game_guides_game_map_hero_updated")
        batch.drop_constraint("ck_game_guides_content_mode", type_="check")
        batch.drop_constraint("ck_game_guides_category", type_="check")
        batch.create_check_constraint("ck_game_guides_category", f"category IN ({OLD_CATEGORY})")
        batch.drop_column("content_mode")
