# Server — Claude Code Context

FastAPI backend + MQTT bridge running on the RPi, inside a Docker container.

## Layout

```
server/
├── app/
│   ├── main.py            # FastAPI app factory ONLY
│   ├── config.py          # Pydantic Settings (env-driven, single source of truth)
│   ├── deps.py            # FastAPI dependency providers (DB session, current user, etc.)
│   ├── db.py              # SQLAlchemy engine, session factory
│   ├── models/            # SQLAlchemy ORM models, one file per aggregate
│   ├── schemas/           # Pydantic request/response models, mirrors routers
│   ├── routers/           # FastAPI route modules — THIN, no business logic
│   ├── services/          # Business logic, transaction boundaries
│   ├── repositories/      # DB query layer (optional — use only if a service has >5 queries)
│   ├── mqtt/              # MQTT bridge as a self-contained module
│   │   ├── bridge.py      # paho-mqtt client lifecycle
│   │   ├── handlers.py    # one handler per topic pattern
│   │   ├── publisher.py   # outbound publish API for services to call
│   │   └── schemas.py     # Pydantic models for MQTT payloads (versioned)
│   ├── security.py        # JWT, argon2 — pure functions, no I/O
│   ├── feature_flags.py   # Flag lookup with in-memory cache, DB-backed
│   └── logging.py         # Structured logging setup
├── alembic/               # migrations
├── tests/
│   ├── unit/              # service & pure-function tests
│   ├── integration/       # router + DB tests via httpx.AsyncClient
│   └── conftest.py        # shared fixtures (DB, mock MQTT, auth tokens)
├── Dockerfile             # Multi-stage build
├── .dockerignore
├── pyproject.toml
├── .env.example
└── CLAUDE.md
```

## Modularity rules

- **Routers are thin.** Validate input via Pydantic, call a service, return its result.
  No SQL, no business logic, no MQTT publishing in routers.
- **Services own transactions and side effects.** A service method = one logical
  unit of work. If a service method does X and then publishes MQTT, both succeed
  or both fail (publish after commit; on publish failure, log and retry, do NOT
  rollback the DB).
- **Repositories optional.** If a service has more than 5 queries, extract them
  into a `repositories/` module. Otherwise keep them inline — premature abstraction
  is worse than no abstraction.
- **One Pydantic schema per direction.** Separate `Create`, `Update`, `Read` models.
  Do not reuse a single model across input and output — they evolve differently.
- **Cross-module communication via function calls, not imports of internals.**
  `services.defect_types.create()` may call `mqtt.publisher.publish_defect_config()`.
  It must NOT reach into `mqtt.bridge` directly.
- **No global state — with one documented exception.** Settings (via
  `lru_cache`) and the in-memory feature-flag cache in
  `app/feature_flags.py` are intentional module-level state. The cache
  is thread-safe (`threading.Lock`) and exposes a `reset_cache()` hook
  for tests and post-write invalidation. Adding any further module-level
  mutable state requires:
  1. A documented `reset_*()` hook callable from tests
  2. Thread-safe access (lock or atomic)
  3. An entry in `docs/decisions.md` explaining why dependency injection
     didn't fit

## Module dependency direction (strict)

```
routers ─▶ services ─▶ repositories ─▶ models ─▶ db
                  └─▶ mqtt.publisher ─▶ mqtt.bridge
                  └─▶ security
                  └─▶ feature_flags
```

Arrows only go down. A model never imports a service. A service never imports
a router. If you need the reverse, you have a missing abstraction — discuss
before adding it.

## Containerization

The server runs inside a Docker container. Local dev uses bind mounts +
`--reload`; production uses the built image without bind mounts.

- `Dockerfile` is multi-stage: `builder` (installs uv, compiles deps) →
  `runtime` (slim Python, copies venv from builder, runs as non-root `app` user)
- SQLite DB lives on a named Docker volume `qc-data`, mounted at `/var/lib/qc`
- Healthcheck: `curl -f http://localhost:8000/health || exit 1`
- Logs go to stdout (JSON), collected by Docker
- Image must build successfully for `linux/arm64` (RPi 4 target) — verify with
  `docker buildx build --platform linux/arm64`

## Configuration

All config via `app/config.py` Pydantic Settings. Three sources, in priority:
1. Environment variables (production)
2. `.env` file (local dev)
3. Defaults in the Settings class (sane fallbacks for tests only)

Never read env vars directly elsewhere in the codebase. If you need a value,
import `settings` from `app.config`. This makes the full configuration surface
visible in one place and testable.

## Feature flags

Three layers, see root `CLAUDE.md`. In server code:

- **Build-time:** typically none — server doesn't have build-time flags
- **Runtime:** env vars exposed via `settings` (e.g., `ENABLE_MQTT_TLS`)
- **Live:** `feature_flags.is_enabled("flag_name", default=False)` reads from
  DB, cached 30s. Use sparingly; prefer config for stable behaviors.

Document every flag in `docs/feature-flags.md` with: name, layer, default,
purpose, when it can be removed.

## Testing

- `pytest-asyncio` with `asyncio_mode = "auto"`
- Each test gets a fresh in-memory SQLite via fixture
- MQTT in tests: mock the publisher at the boundary, assert calls — do not
  run a real broker in unit tests
- Integration tests use `httpx.AsyncClient` against the FastAPI app directly
- A separate `tests/e2e/` directory (optional) runs against the real compose
  stack with `testcontainers-python` — use for critical paths only

## Environment Variables

See `.env.example`. Required:
- `DATABASE_URL` (default `sqlite:////var/lib/qc/qc.db`)
- `JWT_SECRET`
- `MQTT_HOST`, `MQTT_PORT`, `MQTT_USERNAME`, `MQTT_PASSWORD`
- `LOG_LEVEL`, `LOG_FORMAT` (json|text)
- `CORS_ALLOWED_ORIGINS` (comma-separated)
- `FEATURE_FLAGS_REFRESH_SECS` (default 30)
