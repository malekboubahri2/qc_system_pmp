#!/usr/bin/env bash
set -euo pipefail

echo "==> post-create: setting up dev environment"

cd /workspace

# ---- Server: install Python deps, run migrations ----
if [[ -f server/pyproject.toml ]]; then
    echo "==> server: uv sync"
    (cd server && uv sync)
    echo "==> server: alembic upgrade head"
    (cd server && uv run alembic upgrade head)
fi

# ---- Dashboard: install Node deps ----
if [[ -f dashboard/package.json ]]; then
    echo "==> dashboard: pnpm install"
    (cd dashboard && pnpm install --frozen-lockfile)
fi

# ---- Firmware host tests: pre-build if Makefile exists ----
if [[ -f firmware/tests/Makefile ]]; then
    echo "==> firmware/tests: make"
    (cd firmware/tests && make) || echo "(firmware tests not buildable yet — skipping)"
fi

cat <<'EOF'

╭────────────────────────────────────────────────────────╮
│  Painting QC dev environment ready                     │
│                                                        │
│  Quick commands:                                       │
│    cd server    && uv run uvicorn app.main:app --reload│
│    cd dashboard && pnpm dev                            │
│    cd server    && uv run pytest                       │
│    cd dashboard && pnpm test                           │
│                                                        │
│  Mosquitto broker at mosquitto:1883 (no auth, dev)     │
│  Forwarded ports: 8000, 5173, 1883                     │
╰────────────────────────────────────────────────────────╯

EOF
