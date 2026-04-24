"""merge_heads

Revision ID: d15c43b2c823
Revises: ace0bc925c39, c9bfbdb0973f, f8a9b0c1d2e3
Create Date: 2026-04-24 15:10:34.805745

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd15c43b2c823'
down_revision: Union[str, None] = ('ace0bc925c39', 'c9bfbdb0973f', 'f8a9b0c1d2e3')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
