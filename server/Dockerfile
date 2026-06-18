# =============================================================
# Painting QC — server image
# Multi-stage: builder (uv) → runtime (slim, non-root)
# =============================================================

# ── builder ────────────────────────────────────────────────────
FROM python:3.14-slim AS builder

# Fetch uv from its official image — faster than pip install
COPY --from=ghcr.io/astral-sh/uv:0.4 /uv /usr/local/bin/uv

WORKDIR /build

# Copy manifests first so dep layer is cached when only source changes.
COPY pyproject.toml uv.lock ./

ENV VIRTUAL_ENV=/build/.venv
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# ── runtime ────────────────────────────────────────────────────
FROM python:3.14-slim AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd --system app && useradd --system --gid app app

WORKDIR /app

COPY --from=builder /build/.venv /app/.venv
# Scripts in the venv have shebangs pointing to /build/.venv/bin/python (the
# builder path). Symlink /build/.venv → /app/.venv so they resolve correctly
# without rewriting every shebang.
RUN mkdir -p /build && ln -s /app/.venv /build/.venv
COPY app/      ./app/
COPY alembic/  ./alembic/
COPY alembic.ini .

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

RUN mkdir -p /var/lib/qc && chown app:app /var/lib/qc

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run migrations then start the server.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
