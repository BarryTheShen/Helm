"""add custom_variables and data_sources tables

Revision ID: a3b8c9d0e1f2
Revises: 12d257e0ec5e
Create Date: 2026-04-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3b8c9d0e1f2'
down_revision: Union[str, None] = '12d257e0ec5e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('custom_variables',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('type', sa.String(length=20), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name', name='uq_custom_variables_user_name'),
    )
    with op.batch_alter_table('custom_variables', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_custom_variables_user_id'), ['user_id'], unique=False)

    op.create_table('data_sources',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('connector', sa.String(length=100), nullable=False),
        sa.Column('config_json', sa.Text(), nullable=False),
        sa.Column('schema_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('data_sources', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_data_sources_user_id'), ['user_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('data_sources', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_data_sources_user_id'))
    op.drop_table('data_sources')

    with op.batch_alter_table('custom_variables', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_custom_variables_user_id'))
    op.drop_table('custom_variables')
