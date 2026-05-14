# =============================================================================
# Helm — Multi-stage production Dockerfile
#
# Build stage:  Compile the web admin frontend (Vite/React)
# Runtime stage: Python backend that serves the compiled frontend
# =============================================================================

# ---- Build stage: web admin -------------------------------------------------
FROM node:20-alpine AS web-build

WORKDIR /build/web

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ .
RUN npm run build

# ---- Runtime stage: backend -------------------------------------------------
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Install build dependencies needed for some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY backend/pyproject.toml ./
RUN pip install --upgrade pip && pip install -e .

# Copy backend source
COPY backend/ .

# Copy compiled web admin from build stage
COPY --from=web-build /build/web/dist /app/../web/dist

# Default environment variables (override at runtime via docker compose or -e)
ENV SERVER_HOST=0.0.0.0 \
    SERVER_PORT=8000 \
    SERVE_STATIC=true

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host ${SERVER_HOST:-0.0.0.0} --port ${SERVER_PORT:-8000}"]
