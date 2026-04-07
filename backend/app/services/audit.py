from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


async def log_audit(
    db: AsyncSession,
    user_id: str,
    action_type: str,
    resource_type: str,
    resource_id: str | None = None,
    details: dict | None = None,
    ip: str | None = None,
) -> None:
    entry = AuditLog(
        user_id=user_id,
        action_type=action_type,
        resource_type=resource_type,
        resource_id=resource_id,
        details_json=details,
        ip_address=ip,
    )
    db.add(entry)
    # Don't commit — let the calling router's transaction handle it
