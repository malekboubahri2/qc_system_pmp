# =============================================================
# Painting QC — server image
# Multi-stage: builder (uv) → runtime (slim, non-root)
# =============================================================

# ── builder ────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

# Fetch uv from its official image — faster than pip install
COPY --from=ghcr.io/astral-sh/uv:0.4 /uv /usr/local/bin/uv

WORKDIR /build

# Copy only the dependency manifest first so this layer is cached
# when only source code changes.
COPY pyproject.toml .

ENV VIRTUAL_ENV=/build/.venv
RUN uv venv $VIRTUAL_ENV && \
    uv pip install --python $VIRTUAL_ENV/bin/python .

# ── runtime ────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd --system app && useradd --system --gid app app

WORKDIR /app

COPY --from=builder /build/.venv /app/.venv
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
