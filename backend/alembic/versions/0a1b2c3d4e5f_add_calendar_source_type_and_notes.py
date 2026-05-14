"""Add source_type and notes columns to calendar_events

FF4-CAL-026: Add sourceType field (local/caldav/notion/custom)
FF4-CAL-027: Add free-form notes/content field

Revision ID: 0a1b2c3d4e5f
Revises: 5468f59c7834
Create Date: 2026-05-14 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0a1b2c3d4e5f'
down_revision: Union[str, None] = '5468f59c7834'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # FF4-CAL-026: source_type column — tracks event origin (local/caldav/notion/custom)
    op.add_column(
        "calendar_events",
        sa.Column("source_type", sa.String(20), nullable=False, server_default="local"),
    )
    # FF4-CAL-027: notes column — free-form text notes for events
    op.add_column(
        "calendar_events",
        sa.Column("notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("calendar_events", "notes")
    op.drop_column("calendar_events", "source_type")
