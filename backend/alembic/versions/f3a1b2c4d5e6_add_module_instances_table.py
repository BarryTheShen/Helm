"""Add module_instances table and module_instance_id FK to 7 tables

Revision ID: f3a1b2c4d5e6
Revises: 97967c8d628b
Create Date: 2026-04-20 00:00:00.000000

Migration overview:
1. Create module_instances table.
2. Add nullable module_instance_id FK + index to: workflows, trigger_definitions,
   connections, data_sources, notifications, module_states, sdui_screen_history.
3. Backfill: for each distinct user_id that already has rows in any of these tables,
   create one synthetic ModuleInstance(module_type='legacy') and point existing rows
   at it.

Downgrade: drops all added columns then drops the table.
"""

from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


revision: str = "f3a1b2c4d5e6"
down_revision: Union[str, None] = "97967c8d628b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tables that receive the module_instance_id FK.
# Each entry: (table_name, column_position_hint)
_SCOPED_TABLES = [
    "workflows",
    "trigger_definitions",
    "connections",
    "data_sources",
    "notifications",
    "module_states",
    "sdui_screen_history",
]


def upgrade() -> None:
    # ── 1. Create module_instances table ───────────────────────────────────
    op.create_table(
        "module_instances",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("template_id", sa.String(length=36), nullable=True),
        sa.Column("module_type", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False, server_default="0.0.0"),
        sa.Column("manifest_snapshot", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["template_id"], ["sdui_templates.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "module_type", name="uq_module_instances_user_type"),
    )
    with op.batch_alter_table("module_instances", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_module_instances_user_id"), ["user_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_module_instances_template_id"), ["template_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_module_instances_module_type"), ["module_type"], unique=False
        )

    # ── 2. Add module_instance_id column to each scoped table ──────────────
    for table in _SCOPED_TABLES:
        with op.batch_alter_table(table, schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("module_instance_id", sa.String(length=36), nullable=True)
            )
            batch_op.create_index(
                batch_op.f(f"ix_{table}_module_instance_id"),
                ["module_instance_id"],
                unique=False,
            )
            batch_op.create_foreign_key(
                f"fk_{table}_module_instance_id",
                "module_instances",
                ["module_instance_id"],
                ["id"],
                ondelete="CASCADE",
            )

    # ── 3. Backfill — create one legacy instance per user that has data ────
    conn = op.get_bind()

    # Collect distinct user_ids across all scoped tables
    user_ids: set[str] = set()
    for table in _SCOPED_TABLES:
        rows = conn.execute(sa.text(f"SELECT DISTINCT user_id FROM {table}")).fetchall()
        for (uid,) in rows:
            user_ids.add(uid)

    if user_ids:
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

        for user_id in user_ids:
            # Check whether a legacy instance already exists (idempotent)
            existing = conn.execute(
                sa.text(
                    "SELECT id FROM module_instances "
                    "WHERE user_id = :uid AND module_type = 'legacy'"
                ),
                {"uid": user_id},
            ).fetchone()

            if existing:
                instance_id = existing[0]
            else:
                instance_id = str(uuid.uuid4())
                conn.execute(
                    sa.text(
                        "INSERT INTO module_instances "
                        "(id, user_id, module_type, name, version, status, created_at, updated_at) "
                        "VALUES (:id, :uid, 'legacy', 'Legacy', '0.0.0', 'active', :now, :now)"
                    ),
                    {"id": instance_id, "uid": user_id, "now": now},
                )

            # Point all existing rows for this user at the legacy instance
            for table in _SCOPED_TABLES:
                conn.execute(
                    sa.text(
                        f"UPDATE {table} SET module_instance_id = :iid "
                        "WHERE user_id = :uid AND module_instance_id IS NULL"
                    ),
                    {"iid": instance_id, "uid": user_id},
                )


def downgrade() -> None:
    # ── Remove module_instance_id from each scoped table ──────────────────
    for table in _SCOPED_TABLES:
        with op.batch_alter_table(table, schema=None) as batch_op:
            batch_op.drop_constraint(f"fk_{table}_module_instance_id", type_="foreignkey")
            batch_op.drop_index(batch_op.f(f"ix_{table}_module_instance_id"))
            batch_op.drop_column("module_instance_id")

    # ── Drop module_instances table ────────────────────────────────────────
    with op.batch_alter_table("module_instances", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_module_instances_module_type"))
        batch_op.drop_index(batch_op.f("ix_module_instances_template_id"))
        batch_op.drop_index(batch_op.f("ix_module_instances_user_id"))

    op.drop_table("module_instances")
