"""ff4_versioning_and_notes

Revision ID: 59b20307e798
Revises: 5f1877f37748
Create Date: 2026-05-14 07:17:30.826438

Adds:
  - New tables: module_working_drafts, module_versions, preview_sessions, notes
  - New columns on devices: active_app_version_id, preview_session_id,
    installed_runtime_version, supported_schema_versions, update_status
  - New columns on apps: current_working_draft_id, current_published_version_id
  - New columns on module_instances: current_working_draft_id, current_version_id
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "59b20307e798"
down_revision: Union[str, None] = "5f1877f37748"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── New table: module_working_drafts ──────────────────────────────────
    op.create_table(
        "module_working_drafts",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("module_id", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("sdui_json", sa.JSON(), nullable=False),
        sa.Column("last_autosaved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("base_version_id", sa.String(36), nullable=True),
        sa.Column("validation_status", sa.String(20), nullable=False, server_default="unknown"),
        sa.Column("validation_errors", sa.JSON(), nullable=False),
        sa.Column("dirty", sa.Boolean(), nullable=False, server_default=sa.text("0")),
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
        sa.ForeignKeyConstraint(["module_id"], ["module_instances.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("module_working_drafts", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_module_working_drafts_module_id"), ["module_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_module_working_drafts_user_id"), ["user_id"], unique=False
        )

    # ── New table: module_versions ────────────────────────────────────────
    op.create_table(
        "module_versions",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("module_id", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("default_timestamp_name", sa.String(255), nullable=False),
        sa.Column("custom_name", sa.String(255), nullable=True),
        sa.Column("sdui_json", sa.JSON(), nullable=False),
        sa.Column("source", sa.String(50), nullable=False, server_default="checkpoint"),
        sa.Column("parent_version_id", sa.String(36), nullable=True),
        sa.Column("change_summary", sa.String(1000), nullable=True),
        sa.Column("validation_status", sa.String(20), nullable=False, server_default="unknown"),
        sa.Column("validation_errors", sa.JSON(), nullable=False),
        sa.Column("schema_version", sa.String(20), nullable=False, server_default="2.0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["module_id"], ["module_instances.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("module_versions", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_module_versions_module_id"), ["module_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_module_versions_user_id"), ["user_id"], unique=False
        )

    # ── New table: preview_sessions ───────────────────────────────────────
    op.create_table(
        "preview_sessions",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("target_type", sa.String(20), nullable=False),
        sa.Column("app_id", sa.String(36), nullable=True),
        sa.Column("module_id", sa.String(36), nullable=True),
        sa.Column("resolved_config_json", sa.JSON(), nullable=True),
        sa.Column("resolved_sdui_json", sa.JSON(), nullable=True),
        sa.Column("device_id", sa.String(36), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("exited_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["app_id"], ["apps.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["module_id"], ["module_instances.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("preview_sessions", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_preview_sessions_user_id"), ["user_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_preview_sessions_app_id"), ["app_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_preview_sessions_module_id"), ["module_id"], unique=False
        )

    # ── New table: notes ──────────────────────────────────────────────────
    op.create_table(
        "notes",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("title", sa.String(255), nullable=False, server_default="Untitled"),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("notes", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_notes_user_id"), ["user_id"], unique=False)

    # ── New columns on devices ────────────────────────────────────────────
    with op.batch_alter_table("devices", schema=None) as batch_op:
        batch_op.add_column(sa.Column("active_app_version_id", sa.String(36), nullable=True))
        batch_op.add_column(sa.Column("preview_session_id", sa.String(36), nullable=True))
        batch_op.add_column(sa.Column("installed_runtime_version", sa.String(20), nullable=True))
        batch_op.add_column(
            sa.Column("supported_schema_versions", sa.JSON(), nullable=False, server_default=sa.text("'[\"1.0\", \"2.0\"]'"))
        )
        batch_op.add_column(
            sa.Column("update_status", sa.String(20), nullable=False, server_default=sa.text("'up_to_date'"))
        )

    # ── New columns on apps ───────────────────────────────────────────────
    with op.batch_alter_table("apps", schema=None) as batch_op:
        batch_op.add_column(sa.Column("current_working_draft_id", sa.String(36), nullable=True))
        batch_op.add_column(sa.Column("current_published_version_id", sa.String(36), nullable=True))

    # ── New columns on module_instances ───────────────────────────────────
    with op.batch_alter_table("module_instances", schema=None) as batch_op:
        batch_op.add_column(sa.Column("current_working_draft_id", sa.String(36), nullable=True))
        batch_op.add_column(sa.Column("current_version_id", sa.String(36), nullable=True))


def downgrade() -> None:
    # ── Remove columns from module_instances ──────────────────────────────
    with op.batch_alter_table("module_instances", schema=None) as batch_op:
        batch_op.drop_column("current_version_id")
        batch_op.drop_column("current_working_draft_id")

    # ── Remove columns from apps ──────────────────────────────────────────
    with op.batch_alter_table("apps", schema=None) as batch_op:
        batch_op.drop_column("current_published_version_id")
        batch_op.drop_column("current_working_draft_id")

    # ── Remove columns from devices ───────────────────────────────────────
    with op.batch_alter_table("devices", schema=None) as batch_op:
        batch_op.drop_column("update_status")
        batch_op.drop_column("supported_schema_versions")
        batch_op.drop_column("installed_runtime_version")
        batch_op.drop_column("preview_session_id")
        batch_op.drop_column("active_app_version_id")

    # ── Drop notes table ──────────────────────────────────────────────────
    with op.batch_alter_table("notes", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_notes_user_id"))
    op.drop_table("notes")

    # ── Drop preview_sessions table ───────────────────────────────────────
    with op.batch_alter_table("preview_sessions", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_preview_sessions_module_id"))
        batch_op.drop_index(batch_op.f("ix_preview_sessions_app_id"))
        batch_op.drop_index(batch_op.f("ix_preview_sessions_user_id"))
    op.drop_table("preview_sessions")

    # ── Drop module_versions table ────────────────────────────────────────
    with op.batch_alter_table("module_versions", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_module_versions_user_id"))
        batch_op.drop_index(batch_op.f("ix_module_versions_module_id"))
    op.drop_table("module_versions")

    # ── Drop module_working_drafts table ──────────────────────────────────
    with op.batch_alter_table("module_working_drafts", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_module_working_drafts_user_id"))
        batch_op.drop_index(batch_op.f("ix_module_working_drafts_module_id"))
    op.drop_table("module_working_drafts")
