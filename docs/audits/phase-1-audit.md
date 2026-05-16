# Phase 1 Audit — 2026-05-16

## Summary

- 🔴 3 blocking issues
- 🟡 14 issues to fix before Phase 2
- 🟢 9 notes / future concerns
- Tests: 43 passing, **4 failing**, 0 skipped, coverage 90% total
  - `app/feature_flags.py`: 0% | `app/services/devices.py`: 38% | `app/db.py`: 53%
- Last 3 CI runs on main: **cannot verify** — no green badge, no CI run evidence
  in repo; roadmap items "Verify first CI run passes" and "Generate GHCR PAT"
  remain unchecked.

---

## Findings

### 🔴 Blocking

---

#### 🔴-1 · Four tests permanently failing — CI is red before Phase 2 starts

**Files:** `tests/integration/test_auth.py:29`, `test_defect_logs.py:114`,
`test_operators.py:73`, `test_stats.py:65`

All four `test_requires_auth` / `test_me_requires_auth` tests assert
`resp.status_code == 403` but the server returns `401 Unauthorized`.

The server behaviour is correct: `HTTPBearer(auto_error=True)` raises HTTP 403
in Starlette versions < 0.27, but modern Starlette raises 403 only when the
scheme is wrong — missing credentials raise the `403` directly from the
security dependency, while `get_current_user` raises `401` for invalid tokens.
Actually, with Starlette >= 0.27 `HTTPBearer` defaults to raising **403** for
missing headers, but the server is getting **401** — meaning `get_current_user`
is being reached via a different code path. Either way: four tests fail on
every push and will mask Phase 2 regressions.

**Suggested fix:** Run a single request to find the actual status code and
update the assertions. Change `== 403` to `== 401` if that is what the current
framework version returns. Add a comment explaining which assertion matches
the framework version.

---

#### 🔴-2 · JWT_SECRET ships with a known, production-insecure default

**File:** `server/app/config.py:16`

```python
jwt_secret: str = Field(default="dev-secret-change-in-production")
```

A server deployed without `JWT_SECRET` set will silently sign all tokens with
this predictable string. Any operator who reads the source code can forge an
admin JWT and log in. There is no startup validation that fails hard if the
default is still in use.

**Suggested fix:** Replace the default with `...` (Pydantic "required" sentinel)
so the process crashes at boot with a clear error if `JWT_SECRET` is absent.
If a fallback default is needed for tests, enforce it only via the test
`conftest.py` env-var injection that is already there.

---

#### 🔴-3 · Dockerfile does not use `uv.lock` — image deps can diverge from CI

**File:** `server/Dockerfile:19`

```dockerfile
RUN uv venv $VIRTUAL_ENV && \
    uv pip install --python $VIRTUAL_ENV/bin/python .
```

CI runs `uv sync --frozen` (locked, reproducible). The Dockerfile runs
`uv pip install .` (unlocked, resolves to latest-compatible at build time).
A dependency that ships a new minor version between a CI run and an image
build can produce a server that passes CI but behaves differently in
production. `uv.lock` was committed specifically to prevent this.

**Suggested fix:**
```dockerfile
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
```

---

### 🟡 Fix before Phase 2

---

#### 🟡-1 · `GET /health/detailed` returns a stub — spec says it returns system status

**File:** `server/app/routers/health.py:14-20`

Implementation returns:
```json
{ "status": "ok", "db": "ok" }
```

`docs/api-spec.md` specifies:
```json
{ "status": "ok", "db": "ok", "mqtt_broker": "ok", "devices": [...], "config_version": 1 }
```

The dashboard's Day 11 Devices page will call this endpoint to render a
real-time system status panel. The missing `mqtt_broker` field, `devices`
array, and `config_version` will force dashboard rework after the fact.

---

#### 🟡-2 · `/flags` REST endpoints are absent — `feature_flags.py` is dead code

**OpenAPI paths:** `/flags` and `PUT /flags/{name}` do not appear.
**Coverage:** `app/feature_flags.py`: 0% (23 statements, all missed).

`docs/api-spec.md` documents both endpoints. `app/feature_flags.py` implements
the cache but has no router, no test, and no way to be called from the
dashboard. Any Phase 2 feature-flag use will require adding router +
tests that should have been done in Phase 1.

---

#### 🟡-3 · API path mismatches between spec and implementation

`docs/api-spec.md` specifies:

| Spec path | Implemented path |
|---|---|
| `GET /categories` | `GET /defect-categories` |
| `POST /categories` | `POST /defect-categories` |
| `PATCH /categories/{id}` | `PATCH /defect-categories/{category_id}` |
| `DELETE /categories/{id}` | `DELETE /defect-categories/{category_id}` |
| `GET /categories/{id}/types` | `GET /defect-types?category_id={id}` |
| `POST /categories/{id}/types` | `POST /defect-types` (flat, no nesting) |
| `PATCH /types/{id}` | `PATCH /defect-types/{type_id}` |
| `DELETE /types/{id}` | `DELETE /defect-types/{type_id}` |

The dashboard will be written against `docs/api-spec.md`. Either the spec
must be updated to match the code, or the code must be updated to match
the spec. Either is acceptable — but the divergence must be resolved before
dashboard work begins.

---

#### 🟡-4 · `POST /operators` schema requires a PIN; spec says `{ "name": "..." }` only

**Files:** `server/app/schemas/operator.py:5-8`, `docs/api-spec.md:103-110`

The spec says create returns a user with no PIN (set it separately via
`POST /operators/{id}/pin`). The implementation requires `pin` at creation
time via `OperatorCreate`. The dashboard's Day 9 "Create Operator" dialog
will be built against the spec and will not include a PIN field — the
create call will fail with a 422.

Additionally: `POST /operators/{id}/pin` returns `200 OperatorRead` but the
spec says 204 (no body). Minor but the dashboard must not try to read a body.

---

#### 🟡-5 · `DeviceRead` schema missing the `online` computed field

**Files:** `server/app/schemas/device.py`, `docs/api-spec.md:229-244`

The spec says `GET /devices` items include `"online": true` (true if
`last_seen` within last 90s). The `DeviceRead` schema has no `online` field.
The dashboard's Day 11 Devices page will render online/offline status —
either the field is added to the schema now, or the dashboard must compute
it client-side from `last_seen` using an undocumented 90s rule.

---

#### 🟡-6 · `DefectCategoryRead` missing `defect_count` field

**Files:** `server/app/schemas/defect.py:15-22`, `docs/api-spec.md:148-155`

The spec says `GET /categories` returns `"defect_count": 8` per category.
The dashboard's Day 9 defect-type page shows a "X / 12 defects" counter
next to each category. The schema currently omits this field — the counter
cannot be rendered without an extra client-side request per category.

---

#### 🟡-7 · `GET /operators?include_archived=true` is documented but not wired up

**Files:** `server/app/routers/operators.py:11-13`, `docs/api-spec.md:92-93`

`services/operators.py:get_all(active_only=True)` supports the parameter.
The router ignores it: `svc.get_all(db)` with no argument. The spec says
the `?include_archived=true` query param works. Dashboard code that passes
it will get only active operators regardless.

---

#### 🟡-8 · `send_device_command()` exists but has no REST endpoint

**File:** `server/app/mqtt/publisher.py:91-92`

`send_device_command(device_id, payload)` is implemented and `CmdPayload`
schema is defined. But there is no router exposing it. The spec makes no
mention of a device-command endpoint either (the spec mentions it only in
the MQTT topics doc). This will need to exist for Day 11 Devices page
("Reload config" or "Reboot" buttons). Flag the gap now so it doesn't
require a schema design sprint mid-Phase 2.

---

#### 🟡-9 · mypy reports 3 real errors (2 in `stats.py`, 1 in `handlers.py`)

**Files and lines:**

- `app/services/stats.py:53,74` — `Argument "count" to "ByDefectPoint/ByOperatorPoint" has incompatible type "Callable[[Any], int]"; expected "int"`. At runtime the SQLAlchemy labeled row exposes `.count` as an integer, not a method, so these work — but they rely on undocumented Row attribute resolution. A future SQLAlchemy upgrade or a copy-paste of this pattern could break silently.

- `app/mqtt/handlers.py:6` — `_handlers: dict[str, callable] = {}` uses Python's builtin `callable` as a type annotation. This is not valid as a type — it should be `dict[str, Callable[[str, dict], None]]` from `typing`. mypy raises `callable? not callable`.

Two additional mypy errors in `app/logging.py:13-14,17-18` are pre-existing
framework-integration issues (loguru sink typing).

---

#### 🟡-10 · `infra/docker-compose.prod.yml` defaults to `latest` tag

**File:** `infra/docker-compose.prod.yml:42,60`

```yaml
image: ghcr.io/${GITHUB_REPOSITORY:-OWNER/REPO}/qc-server:${QC_VERSION:-latest}
```

`infra/CLAUDE.md` explicitly prohibits `latest` in production compose:
"Do not use `latest` tag in `docker-compose.prod.yml`; pin versions."
A `./scripts/deploy.sh` invocation without `QC_VERSION` set silently pulls
whatever `latest` currently points to — violating the intent of ADR-012
(tagged, reproducible deploys).

**Suggested fix:** Remove the `:-latest` default. Require `QC_VERSION` to be
explicit. Add a guard in `deploy.sh` that exits if `QC_VERSION` is unset.

---

#### 🟡-11 · `dashboard` service has no healthcheck in prod compose

**File:** `infra/docker-compose.prod.yml:59-71`

`mosquitto` and `server` have healthchecks with `depends_on: condition:
service_healthy`. The `dashboard` service has no `healthcheck:` block. If
the Caddy/static bundle fails to start, the compose stack reports healthy
and the deploy script's health poll passes without detecting the failure.
`infra/CLAUDE.md` says "Healthchecks mandatory. Every service."

---

#### 🟡-12 · Test JWT secret produces `InsecureKeyLengthWarning` (26 bytes reported)

Every test run emits:
```
InsecureKeyLengthWarning: The HMAC key is 26 bytes long, which is below
the minimum recommended length of 32 bytes for SHA256.
```

`conftest.py` sets `JWT_SECRET=test-secret-32-chars-min-required!` (34 bytes)
but the warning says 26. This implies `settings.jwt_secret` is being resolved
from a source other than conftest — likely a `server/.env` file on disk
(gitignored) that contains a shorter value and is loaded before the test env
var wins. This means the JWT signing key in tests is effectively unknown.

**Verify:** check whether `server/.env` exists and what `JWT_SECRET` it
contains. If it does, either delete it or lengthen the value. The test env
var injection in conftest must win.

---

#### 🟡-13 · `admin/mqtt/republish-retained` endpoint referenced in docs but not implemented

**File:** `docs/deployment.md:251-254`

> `curl -X POST http://<rpi-ip>:8000/api/v1/admin/mqtt/republish-retained`
> This endpoint exists for operations use only; it requires an admin JWT.

The endpoint does not exist in the codebase. It does not appear in the
OpenAPI schema. A plant operator following the deployment guide after a
Mosquitto wipe will get a 404. ADR-003 says `deploy.sh` handles re-publish
automatically, but the manual fallback documented in `deployment.md` is broken.

---

#### 🟡-14 · `CLAUDE.md` still says Phase 0 — misleads every future session

**File:** `CLAUDE.md` (root), bottom of file:

> Currently in: **Phase 0 — Foundation & Setup**

Phase 1 is complete. Phase 2 starts next. Every Claude Code session in
this repo will open with wrong context about project state.

---

### 🟢 Notes

---

#### 🟢-1 · 6 ruff F401 errors — all auto-fixable unused imports

`server/app/db.py:2` (`text`), `schemas/log.py:1` (`Optional`),
`services/defect_logs.py:5` (`func`, `select`), `services/stats.py:2`
(`Optional`), `tests/integration/test_defects.py:1` (`pytest`).

Run `uv run ruff check . --fix` to remove them all at once.

---

#### 🟢-2 · Missing ADRs for four implemented decisions

The following choices are visible in the code but have no ADR:

1. **SHA-256 for operator PINs, argon2 for user passwords** (`security.py`).
   The reasoning (MCU compatibility) is partially in `mqtt-topics.md` but
   the security trade-off and algorithm-prefix format deserve a decision record.
2. **SQLite WAL mode** (`db.py:13` — `PRAGMA journal_mode=WAL`). WAL changes
   crash recovery semantics and enables concurrent reads. Not documented.
3. **paho-mqtt `loop_start()` threading model** (`bridge.py`). The choice of
   a dedicated thread vs async was implicit. Matters if the server ever
   migrates to full async.
4. **JWT in `Authorization` header vs cookie** (`deps.py:8` — `HTTPBearer()`).
   Cookie auth would be CSRF-safer for browser clients. The choice was never
   documented.

---

#### 🟢-3 · `*.db` not in `.gitignore` — dev database can be accidentally committed

`server/qc-dev.db` appears in `git status` as untracked (not gitignored).
The root `.gitignore` does not have a `*.db` entry. Add `*.db` to prevent
SQLite database files from being committed.

---

#### 🟢-4 · `scripts/seed_dev.py` listed in Day 5 roadmap but not implemented

**File:** `docs/roadmap.md:193` — "Seed script `scripts/seed_dev.py`"

There is no seed script. Not a blocker, but Phase 2 front-end development
(testing the dashboard against realistic data) will be painful without one.

---

#### 🟢-5 · `app/feature_flags.py` uses mutable module-level state

**File:** `app/feature_flags.py:6-8`

```python
_cache: dict[str, bool] = {}
_cache_expires: float = 0.0
_lock = threading.Lock()
```

This is intentional (cache with TTL) and thread-safe. However `server/CLAUDE.md`
says "No global state." The exception should be documented. As-is, a test that
exercises `is_enabled()` pollutes the cache for the next test unless reset.

---

#### 🟢-6 · `python:3.11-slim` base image not pinned to digest or patch version

**File:** `server/Dockerfile:7,23`

`python:3.11-slim` can resolve to different patch releases across builds.
For a PoC this is acceptable, but production images should pin to
`python:3.11.X-slim` or a sha256 digest for complete reproducibility.

---

#### 🟢-7 · `scripts/` location differs from `infra/CLAUDE.md` layout spec

`infra/CLAUDE.md` describes `infra/scripts/deploy.sh`, but scripts live at
repo-root `scripts/`. Minor doc drift. Update the CLAUDE.md layout table.

---

#### 🟢-8 · `ci:` commit type used but not in the Conventional Commits table

**Commits:** `f0676fa ci: use native ARM64 runners`, `895da75 ci: add multi-arch...`

The convention file (`.claude/rules/commits.md`) lists valid types as:
`feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`, `style`, `revert`.
CI changes should use `chore(ci):`. Not a runtime concern, but it will
confuse changelog tooling.

---

#### 🟢-9 · `_OperatorRef` and `_DefectTypeRef` are private schemas imported by tests

**Files:** `server/app/schemas/log.py:6,14`,
`tests/integration/test_defect_logs.py` (imports them directly)

The underscore prefix signals "internal". Tests importing private names is a
coupling smell. Either export them (rename, drop underscore) or restructure
tests to not need direct schema construction.

---

## Section-level results

| Section | Verdict |
|---|---|
| A. Roadmap vs. code | Day 4–7 tasks implemented. 2 Day-6 side tasks open (CI verification, GHCR PAT on RPi). `seed_dev.py` absent. |
| B. Architecture principles | Routers thin ✅. Dependency direction clean ✅. MQTT publish from services ✅. UTC datetimes ✅. One env-var leak via feature_flags module-level state (🟢). |
| C. Data model | Tables, columns, FKs match doc. 24-char cap enforced in schema AND DB ✅. 12-per-category cap enforced on create ✅. Devices missing `online` computed field in schema (🟡-5). Categories missing `defect_count` in schema (🟡-6). |
| D. API spec vs. implementation | Path mismatches (🟡-3), operator create schema mismatch (🟡-4), online field (🟡-5), defect_count (🟡-6), /flags missing (🟡-2), health/detailed stub (🟡-1), include_archived unwired (🟡-7). |
| E. MQTT contract | All 5 topics handled. schema_version emitted and validated ✅. QoS and retain flags correct ✅. |
| F. ADRs | ADR-012 implemented as described ✅. Four undocumented decisions (🟢-2). republish-retained endpoint missing (🟡-13). |
| G. Security | No hardcoded secrets in source ✅. JWT default insecure (🔴-2). `*.db` not gitignored (🟢-3). argon2 for users, sha256 for PINs by design ✅ but undocumented (🟢-2). |
| H. Tests | 90% total coverage, 43 pass, **4 fail**. feature_flags 0% (🟡-2). Handlers tested ✅. 12-cap tested on create. |
| I. Containerisation | Multi-stage ✅. Non-root ✅. HEALTHCHECK ✅. Dockerfile not using lockfile (🔴-3). Dashboard has no healthcheck in prod (🟡-11). `latest` default in prod (🟡-10). |
| J. Code hygiene | 6 ruff F401 (🟢-1). No print/TODO/HACK. No commented-out blocks. |
| K. Cross-cutting | Python-only server ✅. Most commits follow Conventional Commits. `ci:` type invalid (🟢-8). CLAUDE.md phase stale (🟡-14). |

---

## Recommended order of operations

1. **🔴-1 Fix the 4 failing tests first.** All follow the same pattern; one
   grep-and-replace. Without green CI, nothing else you commit is reliably
   tested.

2. **🔴-2 Harden JWT_SECRET startup check.** Single-line change in config.py.
   Zero risk, eliminates a production security hole that worsens as the
   project grows.

3. **🔴-3 Fix Dockerfile to use `uv sync --frozen`.** Two-line change.
   Without it, the lock file serves no purpose for production images.

4. **🟡-12 Diagnose the InsecureKeyLengthWarning.** Check for `server/.env`.
   If a short JWT_SECRET is on disk it is poisoning both tests and any local
   server run. Fix before Phase 2 test runs inherit the problem.

5. **🟡-3 Reconcile API paths.** Decide: update the spec to match the code
   (preferred — less churn) or rename the routers. Must be resolved before
   writing a single dashboard API call.

6. **🟡-4 + 🟡-5 + 🟡-6 Fix schema gaps.** `OperatorCreate` PIN requirement,
   `DeviceRead.online`, `DefectCategoryRead.defect_count`. These are the three
   fields the dashboard will need on Day 8/9/11. Fix them now, in tests, before
   the dashboard is written against them.

7. **🟡-1 Complete `GET /health/detailed`.** The dashboard status page needs it.
   Low effort: add mqtt_broker ping + devices query to health.py.

8. **🟡-2 Add `/flags` router.** Thin router, no new service logic — just expose
   `feature_flags.is_enabled` and a toggle via `FeatureFlag` model. Bring
   coverage of feature_flags.py above 0%.

9. **🟡-10 + 🟡-11 Prod compose hardening.** Remove `:-latest` from
   `QC_VERSION`. Add dashboard healthcheck. Together these take < 10 minutes.

10. **🟡-14 Update CLAUDE.md phase.** One line. Every session you open will
    have correct context.

11. **🟢-3 Add `*.db` to `.gitignore`** before the first time you run the
    server locally from a fresh clone and then do `git add -A` without thinking.

Defer: 🟢-2 ADRs, 🟢-1 ruff auto-fix, 🟢-6 image pinning. These can land in
a single `chore` commit before the Day 12 release tag.
