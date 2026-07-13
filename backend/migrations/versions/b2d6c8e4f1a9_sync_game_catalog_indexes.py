"""sync game catalog indexes with the ORM metadata

Revision ID: b2d6c8e4f1a9
Revises: f6a0c7e9b214
"""

from alembic import op


revision = "b2d6c8e4f1a9"
down_revision = "f6a0c7e9b214"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_index("ix_game_guides_category", table_name="game_guides")
    op.drop_index("ix_game_guides_difficulty", table_name="game_guides")
    op.drop_index("ix_game_guides_game_version", table_name="game_guides")
    op.create_index("ix_games_status_created", "games", ["status", "created_at"])
    op.create_index("ix_game_heroes_game_status", "game_heroes", ["game_id", "status", "review_status"])
    op.create_index("ix_game_maps_game_review", "game_maps", ["game_id", "review_status"])


def downgrade():
    op.drop_index("ix_game_maps_game_review", table_name="game_maps")
    op.drop_index("ix_game_heroes_game_status", table_name="game_heroes")
    op.drop_index("ix_games_status_created", table_name="games")
    op.create_index("ix_game_guides_game_version", "game_guides", ["game_version"])
    op.create_index("ix_game_guides_difficulty", "game_guides", ["difficulty"])
    op.create_index("ix_game_guides_category", "game_guides", ["category"])
