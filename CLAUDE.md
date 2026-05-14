# Painting QC Digitalization — Project Context

> This file is read automatically by Claude Code on every session in this repo.
> Keep it concise, factual, and current. Update when architecture changes.

---

## What This Project Is

A proof-of-concept system that digitalizes paper-based quality control logging
in a paint finishing plant. Operators tap defects on a touchscreen terminal
instead of writing on paper sheets; the QC responsable configures defect types
and monitors patterns in real time from a web dashboard.

The PoC must demonstrate three things:
1. Operators can log defects at least as fast as on paper.
2. The QC responsable can configure defect types from the web and see them
   appear on the terminal within seconds.
3. The dashboard surfaces patterns (by time, defect type, operator) that
   would be invisible on paper.

---

## Hardware

- **Server:** Raspberry Pi 4B 8GB, Raspberry Pi OS Lite 64-bit (Bookworm).
  Wired Ethernet on the plant LAN, static IP.
- **End device:** STM32H750B-DK discovery board. 4.3" 480×272 capacitive
  touch LCD, on-board Ethernet PHY (LAN8742), 128 MB QSPI flash for assets
  and offline queue, Chrom-ART for GUI acceleration.

Network: both devices on the same plant LAN switch. No Wi-Fi.

---

## ⭐ Top-Level Engineering Principles

These principles override convenience. If a proposed solution violates one
of them, push back and propose an alternative.

### 1. Modularity over monoliths

Extra files are fine; tangled responsibilities are not. Every module owns
one concern, exposes a narrow interface, and has zero knowledge of its
callers. If you cannot describe a module's responsibility in one sentence,
it is too big — split it.

- One concept per file, one file per concept
- Public interface in a header / index / `__init__.py`; rest is private
- No circular dependencies, ever
- Higher-level modules depend on lower-level, never the reverse
- Cross-cutting concerns (logging, config, time) are injected, not imported
  directly into business logic

### 2. Portability over environment coupling

Code must run on a developer laptop, a CI runner, and the RPi without
changes. Achieve this with environment variables, dependency injection, and
hardware abstraction layers — never with hardcoded paths, IPs, or assumptions.

- **Server & dashboard:** every deployable runs in a Docker container.
  Compose files describe the local dev stack. Native install on RPi is
  also supported but Docker is the default.
- **Firmware:** every hardware dependency is behind a HAL or driver
  abstraction. Application code is testable on a host with mock drivers.
- All configuration via environment variables, config files, or build
  flags — never hardcoded in source.

### 3. Reusability through clear contracts

Today the PoC has one server, one device, one plant. Tomorrow it might
have ten devices, three plants, an MES integration. Build for that without
over-engineering for it.

- Stable, documented interfaces between components
- Versioned APIs and MQTT message schemas
- Generic primitives in shared modules, plant-specific config in deployment
- No "magic" — explicit is better than clever

### 4. Future-readiness via feature flags & build flags

Anywhere a behavior might evolve or be toggled, gate it behind a flag at
the appropriate layer (env var, config setting, C macro, build option).
Make removing or changing a feature a config change, not a code change.

### 5. Idiomatic for the platform

Modularity in Python looks different from modularity in C. Follow the
idioms native to each language and ecosystem; don't impose patterns from
one onto another.

---

## Tech Stack (locked — do not change without an ADR)

### Server (`server/`)
- Python 3.11+
- FastAPI + Uvicorn
- SQLAlchemy 2.0 + Alembic
- SQLite (WAL mode) — single file, easy backup
- `paho-mqtt` for the MQTT bridge
- Mosquitto broker (separate container)
- JWT for dashboard auth, argon2 for password and PIN hashing
- pytest for tests
- **Docker** for packaging and deployment

### Dashboard (`dashboard/`)
- React 18 + TypeScript + Vite
- TailwindCSS + shadcn/ui
- TanStack Query for server state
- React Router v6
- Zod for form validation
- Recharts for analytics
- **Docker** multi-stage build → Caddy-served static bundle

### Firmware (`firmware/`)
- STM32CubeIDE + STM32CubeMX (HAL, not LL)
- TouchGFX 4.x
- FreeRTOS (CMSIS-RTOS v2 wrapper)
- LwIP (DHCP, SNTP, raw API)
- coreMQTT (vendored, MIT)
- jsmn for JSON parsing
- **No dynamic allocation in steady state**

### Infra (`infra/`)
- Docker Compose for local dev (server + mosquitto + dashboard + caddy)
- Docker Compose for production on RPi (same images, different env)
- Optionally: LXC container on RPi for the whole stack as an isolation
  alternative — documented but not the default

---

## Architecture (one-paragraph summary)

The STM32 is a thin client: it renders a TouchGFX UI whose content is
driven by a `DefectConfig` model received over MQTT. The QC responsable
edits defects in the React dashboard, which calls FastAPI, which writes
to SQLite and publishes a retained MQTT message on `qc/config/defects`.
Mosquitto pushes that message to every connected STM32; the firmware
parses the JSON, persists it to QSPI flash, and rebinds the UI. Defect
logs flow the other direction: operator taps a button → STM32 publishes
on `qc/device/{id}/defect` (QoS 1) → MQTT bridge writes the row to SQLite
→ dashboard sees it on next query. Offline: STM32 queues to QSPI flash
and drains on reconnect.

---

## MQTT Topics (full spec in `docs/mqtt-topics.md`)

| Topic | Direction | QoS | Retained | Purpose |
|---|---|---|---|---|
| `qc/config/defects` | server→device | 1 | yes | Full defect/category config |
| `qc/config/operators` | server→device | 1 | yes | Operator list with PIN hashes |
| `qc/device/{id}/cmd` | server→device | 1 | no | Reboot, reload, etc. |
| `qc/device/{id}/status` | device→server | 0 | no | Heartbeat every 30s |
| `qc/device/{id}/defect` | device→server | 1 | no | A defect log entry |

`{id}` is the STM32's hardware UID, lowercase hex, e.g. `qc-stm32-001a2b3c`.

Schemas are versioned. Every payload includes a `schema_version` field.
Server and firmware both validate it and refuse unknown versions.

---

## Data Model (full spec in `docs/data-model.md`)

Tables: `operators`, `defect_categories`, `defect_types`, `defect_logs`,
`devices`, `users` (for dashboard auth).

Hard rules:
- Never hard-delete rows. Use `active` (bool) and `archived_at` (timestamp).
- Every `defect_logs` row carries `device_id`, `operator_id`, `defect_type_id`,
  `product_ref` (string), `logged_at` (device time), `received_at` (server time).
- Cap: 12 defects per category, enforced server-side. Label ≤ 24 chars.

---

## Repository Layout

```
painting-qc/
├── server/         # FastAPI app (see server/CLAUDE.md)
├── dashboard/      # React app (see dashboard/CLAUDE.md)
├── firmware/       # STM32 project (see firmware/CLAUDE.md)
├── infra/          # Dockerfiles, Compose, LXC profiles, deploy scripts
│   ├── docker-compose.dev.yml
│   ├── docker-compose.prod.yml
│   ├── caddy/Caddyfile
│   ├── mosquitto/   # config, ACLs
│   └── lxc/         # optional LXC alternative
├── docs/           # Architecture, API spec, MQTT topics, ADRs
├── scripts/        # Deploy, backup, dev helpers (thin wrappers around compose)
└── CLAUDE.md       # This file
```

Each sub-component has its own `CLAUDE.md` with local conventions.

---

## Containerization (mandatory)

Every server-side deployable is a container. Local dev = `docker compose up`.
Production = same compose file with different `.env`. No service should
require host installation beyond Docker itself.

- Each Dockerfile multi-stage, builder + slim runtime
- Images run as non-root user
- Healthchecks defined for every service
- Compose declares networks, volumes, depends_on, restart policies
- No bind-mounting source code in production; volumes only for data
- Image tags semver per component (`qc-server:0.1.0`), `latest` only on `main`

LXC is supported as an alternative isolation mechanism on the RPi for users
who prefer it over Docker (lower overhead). LXC profiles live in `infra/lxc/`
and run the same compose stack inside the container. Docker remains the
default.

---

## Feature Flags & Configuration Hierarchy

A consistent pattern across all components:

1. **Build-time flags** — change rarely, often platform-specific.
   - Server/dashboard: env vars at image build (rare)
   - Firmware: C macros in `app_config.h`, set via `-D` in build system
2. **Runtime config** — change per deployment, not per request.
   - Server/dashboard: env vars at container start
   - Firmware: config struct loaded from QSPI flash at boot
3. **Live-toggleable flags** — change without redeploy/reflash.
   - Server: DB-backed `feature_flags` table, cached in memory
   - Firmware: pushed via MQTT `qc/config/flags` (retained)

Anywhere code branches on environment, plant, customer, or experimental
behavior, gate it via the correct layer above. Document every flag in
`docs/feature-flags.md`.

---

## Conventions

- **Commits:** Conventional Commits format. Small, focused commits.
- **Branches:** `main` is always deployable. Feature branches `feat/<phase>-<short-desc>`.
- **Versioning:** Semver on each component independently. PoC starts at 0.1.0.
- **Logs:** Structured (JSON) on server. Plain text on firmware (ITM/SWO).
- **Secrets:** `.env` files (gitignored), `.env.example` documents required vars.
  In production: Docker secrets or env injection from a vault.
- **Time:** UTC everywhere on the wire. Display in local time (Europe/Paris)
  only in the dashboard UI layer.
- **IDs in API responses:** Integers from SQLite. No UUIDs unless we later
  federate across plants.

---

## Do NOT

- Do not hardcode IPs, hostnames, ports, or file paths anywhere in source.
- Do not introduce a second backend language. Python only on the server.
- Do not add Wi-Fi to the STM32 path. Ethernet is the contract.
- Do not use raw HTTP from the STM32 for defect logs. MQTT only.
- Do not allocate dynamically in firmware steady-state code paths.
- Do not bypass the retained-message pattern for config. The STM32 must
  be usable with cached config on first boot before MQTT connects.
- Do not commit binaries, build artifacts, `node_modules`, or `.env` files.
- Do not write business logic inside TouchGFX View classes. Views render;
  Presenters decide; Models hold state.
- Do not install services natively on the RPi if a container exists for them.
- Do not introduce a module without its place in the dependency graph being
  obvious — if you have to argue where it belongs, the boundary is wrong.

---

## When Helping Me, Prefer

- Concrete code over explanation, when the design is already decided.
- Pointing at existing files in the repo over generating new ones.
- Asking one clarifying question if a request is ambiguous, not three.
- Following the existing patterns in the nearest sibling file.
- Generating tests alongside non-trivial code changes.
- Surfacing principle violations explicitly: "this couples the MQTT
  handler to the auth module — extract an interface instead?"

---

## Build & Run Commands

### Full stack (local dev)
```bash
docker compose -f infra/docker-compose.dev.yml up --build
# Server:    http://localhost:8000
# Dashboard: http://localhost:5173
# Mosquitto: tcp://localhost:1883
```

### Server only (without Docker, for fast iteration)
```bash
cd server
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
uv run pytest
```

### Dashboard only (without Docker)
```bash
cd dashboard
pnpm install
pnpm dev
pnpm test
```

### Firmware
- Open `firmware/PaintingQC.ioc` in STM32CubeMX
- Open `firmware/TouchGFX/PaintingQC.touchgfx` in TouchGFX Designer
- Build & flash from STM32CubeIDE (target: STM32H750B-DK, ST-Link)
- Host-side tests: `cd firmware/tests && make && ./run_tests`

### Deploy to RPi
```bash
./scripts/deploy.sh         # ships compose stack to RPi, pulls/builds, restarts
./scripts/backup-db.sh      # snapshot SQLite to ./backups/
```

---

## Status

Currently in: **Phase 0 — Foundation & Setup** (see `docs/roadmap.md`).