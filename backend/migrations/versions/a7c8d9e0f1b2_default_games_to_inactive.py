"""default new games to inactive

Revision ID: a7c8d9e0f1b2
Revises: d1e2f3a4b5c6
Create Date: 2026-07-24
"""

from alembic import op
import sqlalchemy as sa


revision = "a7c8d9e0f1b2"
down_revision = "d1e2f3a4b5c6"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "games",
        "status",
        existing_type=sa.String(length=20),
        existing_nullable=False,
        server_default="inactive",
    )


def downgrade():
    op.alter_column(
        "games",
        "status",
        existing_type=sa.String(length=20),
        existing_nullable=False,
        server_default="active",
    )
