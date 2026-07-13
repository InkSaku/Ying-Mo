"""add admin action idempotency key

Revision ID: 9b4e6f2a8c10
Revises: 7a2d9c4e1f30
"""
from alembic import op
import sqlalchemy as sa


revision = "9b4e6f2a8c10"
down_revision = "7a2d9c4e1f30"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("admin_logs", sa.Column("idempotency_key", sa.String(length=36), nullable=True))
    op.create_unique_constraint("uq_admin_logs_idempotency_key", "admin_logs", ["idempotency_key"])


def downgrade():
    op.drop_constraint("uq_admin_logs_idempotency_key", "admin_logs", type_="unique")
    op.drop_column("admin_logs", "idempotency_key")
