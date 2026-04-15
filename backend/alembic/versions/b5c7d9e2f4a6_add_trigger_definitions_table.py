"""add trigger_definitions table

Revision ID: b5c7d9e2f4a6
Revises: a3b8c9d0e1f2
Create Date: 2026-04-13 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b5c7d9e2f4a6'
down_revision: Union[str, None] = 'a3b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('trigger_definitions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('trigger_type', sa.String(length=50), nullable=False),
        sa.Column('config_json', sa.Text(), nullable=False),
        sa.Column('action_chain_json', sa.Text(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('trigger_definitions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_trigger_definitions_user_id'), ['user_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('trigger_definitions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_trigger_definitions_user_id'))
    op.drop_table('trigger_definitions')
