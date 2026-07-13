"""add moderation and administration

Revision ID: f6a0c7e9b214
Revises: e5f4b3a2917d
"""
from alembic import op
import sqlalchemy as sa


revision = "f6a0c7e9b214"
down_revision = "e5f4b3a2917d"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("reporter_id", sa.Integer(), nullable=False), sa.Column("target_type", sa.String(30), nullable=False), sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(40), nullable=False), sa.Column("description", sa.String(1000)), sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("active_key", sa.String(255), unique=True), sa.Column("assigned_to_id", sa.Integer()), sa.Column("handled_by_id", sa.Integer()),
        sa.Column("resolution_action", sa.String(50)), sa.Column("resolution_message", sa.String(1000)), sa.Column("internal_note", sa.Text()), sa.Column("target_snapshot", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False), sa.Column("handled_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("target_type IN ('life_post', 'game_guide', 'comment', 'user')", name="ck_reports_target_type"),
        sa.CheckConstraint("reason IN ('inappropriate', 'violence_illegal', 'harassment', 'spam', 'plagiarism', 'incorrect_tutorial', 'duplicate', 'other')", name="ck_reports_reason"),
        sa.CheckConstraint("status IN ('pending', 'in_progress', 'resolved', 'rejected')", name="ck_reports_status"),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"], ondelete="RESTRICT"), sa.ForeignKeyConstraint(["assigned_to_id"], ["users.id"], ondelete="SET NULL"), sa.ForeignKeyConstraint(["handled_by_id"], ["users.id"], ondelete="SET NULL"),
    )
    for name, cols in (("ix_reports_reporter_created", ["reporter_id", "created_at"]), ("ix_reports_target", ["target_type", "target_id"]), ("ix_reports_status_created", ["status", "created_at"]), ("ix_reports_assigned_status_updated", ["assigned_to_id", "status", "updated_at"]), ("ix_reports_reason_status", ["reason", "status"])): op.create_index(name, "reports", cols)
    op.create_table(
        "admin_logs", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("admin_id", sa.Integer()), sa.Column("admin_role", sa.String(32), nullable=False), sa.Column("action", sa.String(80), nullable=False),
        sa.Column("target_type", sa.String(30), nullable=False), sa.Column("target_id", sa.Integer()), sa.Column("target_label", sa.String(255)), sa.Column("before_data", sa.JSON()), sa.Column("after_data", sa.JSON()), sa.Column("metadata", sa.JSON()),
        sa.Column("ip_address", sa.String(64)), sa.Column("user_agent", sa.String(512)), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.ForeignKeyConstraint(["admin_id"], ["users.id"], ondelete="SET NULL"),
    )
    for name, cols in (("ix_admin_logs_admin_created", ["admin_id", "created_at"]), ("ix_admin_logs_target", ["target_type", "target_id"]), ("ix_admin_logs_action_created", ["action", "created_at"])): op.create_index(name, "admin_logs", cols)
    op.create_table(
        "featured_content", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("target_type", sa.String(30), nullable=False), sa.Column("target_id", sa.Integer(), nullable=False), sa.Column("featured_by_id", sa.Integer(), nullable=False), sa.Column("note", sa.String(500)), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("target_type IN ('life_post', 'game_guide')", name="ck_featured_content_target_type"), sa.ForeignKeyConstraint(["featured_by_id"], ["users.id"], ondelete="RESTRICT"), sa.UniqueConstraint("target_type", "target_id", name="uq_featured_content_target"),
    )
    op.create_index("ix_featured_content_created", "featured_content", ["created_at"])
    with op.batch_alter_table("life_chapters") as batch:
        batch.add_column(sa.Column("aliases", sa.JSON(), nullable=False, server_default=sa.text("(JSON_ARRAY())")))
        batch.add_column(sa.Column("review_status", sa.String(20), nullable=False, server_default="approved"))
        batch.add_column(sa.Column("review_note", sa.String(1000)))
        batch.add_column(sa.Column("reviewed_by_id", sa.Integer()))
        batch.add_column(sa.Column("reviewed_at", sa.DateTime(timezone=True)))
        batch.add_column(sa.Column("merged_into_id", sa.Integer()))
        batch.create_foreign_key("fk_life_chapters_reviewed_by", "users", ["reviewed_by_id"], ["id"], ondelete="SET NULL")
        batch.create_foreign_key("fk_life_chapters_merged_into", "life_chapters", ["merged_into_id"], ["id"], ondelete="SET NULL")
        batch.create_check_constraint("ck_life_chapters_review_status", "review_status IN ('pending', 'approved', 'rejected')")
        batch.create_index("ix_life_chapters_review_status", ["review_status"])
    op.execute("UPDATE life_chapters SET review_status = 'approved' WHERE review_status IS NULL")
    for table in ("life_posts", "game_guides"):
        with op.batch_alter_table(table) as batch:
            batch.add_column(sa.Column("moderation_reason", sa.String(1000)))
            batch.add_column(sa.Column("hidden_at", sa.DateTime(timezone=True)))
            batch.add_column(sa.Column("hidden_by_id", sa.Integer()))
            batch.create_foreign_key(f"fk_{table}_hidden_by", "users", ["hidden_by_id"], ["id"], ondelete="SET NULL")


def downgrade():
    for table in ("game_guides", "life_posts"):
        with op.batch_alter_table(table) as batch:
            batch.drop_constraint(f"fk_{table}_hidden_by", type_="foreignkey")
            batch.drop_column("hidden_by_id"); batch.drop_column("hidden_at"); batch.drop_column("moderation_reason")
    with op.batch_alter_table("life_chapters") as batch:
        batch.drop_index("ix_life_chapters_review_status"); batch.drop_constraint("ck_life_chapters_review_status", type_="check")
        batch.drop_constraint("fk_life_chapters_merged_into", type_="foreignkey"); batch.drop_constraint("fk_life_chapters_reviewed_by", type_="foreignkey")
        batch.drop_column("merged_into_id"); batch.drop_column("reviewed_at"); batch.drop_column("reviewed_by_id"); batch.drop_column("review_note"); batch.drop_column("review_status"); batch.drop_column("aliases")
    op.drop_table("featured_content"); op.drop_table("admin_logs"); op.drop_table("reports")
