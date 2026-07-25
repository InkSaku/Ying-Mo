"""add chapter contribution policy

Revision ID: c8e4f2a1b907
Revises: a7c8d9e0f1b2
"""
from alembic import op
import sqlalchemy as sa


revision = "c8e4f2a1b907"
down_revision = "a7c8d9e0f1b2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "life_chapters",
        sa.Column(
            "contribution_policy",
            sa.String(length=20),
            nullable=False,
            server_default="public",
        ),
    )
    op.create_check_constraint(
        "ck_life_chapters_contribution_policy",
        "life_chapters",
        "contribution_policy IN ('public', 'private')",
    )
    op.create_index(
        "ix_life_chapters_contribution_policy",
        "life_chapters",
        ["contribution_policy"],
    )


def downgrade():
    op.drop_index(
        "ix_life_chapters_contribution_policy",
        table_name="life_chapters",
    )
    op.drop_constraint(
        "ck_life_chapters_contribution_policy",
        "life_chapters",
        type_="check",
    )
    op.drop_column("life_chapters", "contribution_policy")
