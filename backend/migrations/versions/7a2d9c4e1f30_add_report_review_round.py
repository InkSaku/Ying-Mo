"""add report review round

Revision ID: 7a2d9c4e1f30
Revises: b2d6c8e4f1a9
"""
from alembic import op
import sqlalchemy as sa


revision = "7a2d9c4e1f30"
down_revision = "b2d6c8e4f1a9"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("reports", sa.Column("review_round", sa.Integer(), server_default="1", nullable=False))


def downgrade():
    op.drop_column("reports", "review_round")
