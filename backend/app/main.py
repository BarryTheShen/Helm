import sys
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.config import settings
from app.services.workflow_engine import start_scheduler, stop_scheduler

# Configure loguru
logger.remove()
logger.add(sys.stderr, level="INFO", colorize=True, format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.server_name} v{settings.server_version}")
    await start_scheduler()

    # Start the MCP StreamableHTTP session manager.
    # FastAPI does not invoke sub-app lifespans when using app.mount(), so we
    # must manually enter the session manager's context here.  Without this the
    # task-group is never initialised and every MCP request returns 500.
    _mcp_session_cm = None
    try:
        from app.mcp.server import mcp  # noqa: PLC0415
        sm = mcp.session_manager  # None until streamable_http_app() has been called
        if sm is not None:
            _mcp_session_cm = sm.run()
            await _mcp_session_cm.__aenter__()
            logger.info("MCP session manager started")
    except Exception as exc:
        logger.warning(f"MCP session manager not started: {exc}")
        _mcp_session_cm = None

    # Seed component registry with defaults (no-op if already populated)
    from app.database import AsyncSessionLocal  # noqa: PLC0415
    from app.services.component_seed import seed_components  # noqa: PLC0415
    from app.services.template_seed import seed_templates  # noqa: PLC0415
    async with AsyncSessionLocal() as seed_db:
        await seed_components(seed_db)
        await seed_templates(seed_db)

    # Start the 2-minute time alert task (opt-in via DEMO_TIME_ALERTS=true in .env)
    import asyncio as _asyncio
    _alert_task = _asyncio.create_task(_run_time_alerts()) if settings.demo_time_alerts else None

    try:
        yield
    finally:
        if _alert_task is not None:
            _alert_task.cancel()
        if _mcp_session_cm is not None:
            with suppress(Exception):
                await _mcp_session_cm.__aexit__(None, None, None)
        await stop_scheduler()
        logger.info("Helm backend stopped")


async def _run_time_alerts() -> None:
    """Background task: broadcast the current time to all connected users every 2 minutes.

    Saves each alert to the DB and broadcasts via WebSocket so the Alerts tab
    receives it live AND shows it on next page load.
    Starts 2 minutes after server startup to avoid noise during development restarts.
    """
    import asyncio
    import uuid
    from datetime import datetime, timezone
    from app.database import AsyncSessionLocal
    from app.models.notification import Notification
    from app.services.websocket_manager import manager

    await asyncio.sleep(120)  # initial 2-minute delay
    while True:
        now = datetime.now(timezone.utc)
        time_str = now.strftime("%H:%M:%S UTC")
        date_str = now.strftime("%A, %B %d %Y")
        title = "⏰ Time Check"
        message = f"Current time: {time_str}\n{date_str}"
        logger.info(f"Time alert broadcast: {time_str}")

        connected = list(manager.connected_user_ids)

        # Persist a notification to the DB for every connected user, then broadcast.
        async with AsyncSessionLocal() as db:
            for user_id in connected:
                notification = Notification(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    title=title,
                    message=message,
                    severity="info",
                )
                db.add(notification)
            with suppress(Exception):
                await db.commit()

        for user_id in connected:
            with suppress(Exception):
                await manager.send(user_id, {
                    "type": "notification",
                    "title": title,
                    "message": message,
                    "severity": "info",
                    "timestamp": now.isoformat(),
                })

        await asyncio.sleep(120)  # repeat every 2 minutes


app = FastAPI(
    title=settings.server_name,
    version=settings.server_version,
    description="Helm — Agentic AI Super App Backend",
    lifespan=lifespan,
)

# Sandbox middleware must be added BEFORE CORS so it wraps the full request lifecycle
from app.middleware.sandbox import SandboxMiddleware  # noqa: E402
app.add_middleware(SandboxMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "version": settings.server_version}


# Register routers
from app.routers import auth, modules, chat, calendar, notifications, agent_config, websocket, workflows, actions, users, sessions, audit, components, templates, admin  # noqa: E402

app.include_router(auth.router)
app.include_router(modules.router)
app.include_router(templates.router)
app.include_router(chat.router)
app.include_router(calendar.router)
app.include_router(notifications.router)
app.include_router(agent_config.router)
app.include_router(workflows.router)
app.include_router(actions.router)
app.include_router(users.router)
app.include_router(sessions.router)
app.include_router(audit.router)
app.include_router(components.router)
app.include_router(admin.router)
app.include_router(websocket.router)

# Mount MCP server
try:
    from app.mcp.server import get_mcp_asgi_app
    mcp_app = get_mcp_asgi_app()
    app.mount(settings.mcp_path, mcp_app)
    logger.info(f"MCP server mounted at {settings.mcp_path}")
except Exception as exc:
    logger.warning(f"MCP server not mounted: {exc}")

# Mount admin panel static files if built
import os
from fastapi.staticfiles import StaticFiles

admin_dist = os.path.join(os.path.dirname(__file__), '..', '..', 'web', 'dist')
if os.path.isdir(admin_dist):
    app.mount("/admin", StaticFiles(directory=admin_dist, html=True), name="admin")
