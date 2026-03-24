import sys
from contextlib import asynccontextmanager

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
    yield
    await stop_scheduler()
    logger.info("Helm backend stopped")


app = FastAPI(
    title=settings.server_name,
    version=settings.server_version,
    description="Helm — Agentic AI Super App Backend",
    lifespan=lifespan,
)

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
from app.routers import auth, modules, chat, calendar, notifications, agent_config, websocket, workflows  # noqa: E402

app.include_router(auth.router)
app.include_router(modules.router)
app.include_router(chat.router)
app.include_router(calendar.router)
app.include_router(notifications.router)
app.include_router(agent_config.router)
app.include_router(workflows.router)
app.include_router(websocket.router)

# Mount MCP server
try:
    from app.mcp.server import get_mcp_asgi_app
    mcp_app = get_mcp_asgi_app()
    app.mount(settings.mcp_path, mcp_app)
    logger.info(f"MCP server mounted at {settings.mcp_path}")
except Exception as exc:
    logger.warning(f"MCP server not mounted: {exc}")
