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
  Wired Ethernet on the plant LAN, static IP. Also runs the Wi-Fi access
  point (or is reachable from one) that STM32 devices connect to.
- **End device:** STM32H750**B3I**-DK Discovery kit.
  - STM32H7B3LIH6Q Cortex-M7 @ 280 MHz
  - 2 MB internal flash, 1.4 MB internal RAM
  - 4.3" 480×272 capacitive touch LCD (RGB interface, on-board)
  - 128 Mbit SDRAM (16 MB), 512 Mbit Octo-SPI flash (64 MB) on-board
  - Inventek ISM43340-M4G-L44-10CF Wi-Fi module (802.11 b/g/n) on SPI —
    self-contained module with its own STM32F405 + Cypress radio, runs its
    own TCP/IP stack, controlled by AT commands over SPI
  - STLINK-V3E on-board

Network: STM32 connects to plant Wi-Fi (or a dedicated AP); RPi is on the
same Wi-Fi network (via wired Ethernet to the AP, or via its own Wi-Fi
interface). Both reach Mosquitto on the RPi at a fixed IP.

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
- **Firmware:** every hardware dependency is behind a HAL or driver
  abstraction. Application code is testable on a host with mock drivers.
  Critically, the **network transport is pluggable** — Wi-Fi today, wired
  Ethernet tomorrow, behind the same interface.
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
- Python 3.11+, FastAPI + Uvicorn
- SQLAlchemy 2.0 + Alembic, SQLite (WAL mode)
- `paho-mqtt` for the MQTT bridge
- Mosquitto broker (separate container)
- JWT for dashboard auth, argon2 for password and PIN hashing
- pytest, **Docker** for packaging

### Dashboard (`dashboard/`)
- React 18 + TypeScript + Vite
- TailwindCSS + shadcn/ui, TanStack Query, React Router v6, Zod, Recharts
- **Docker** multi-stage → Caddy-served static bundle

### Firmware (`firmware/`)
- STM32CubeIDE + STM32CubeMX (HAL, not LL)
- TouchGFX 4.x
- FreeRTOS (CMSIS-RTOS v2 wrapper)
- **Inventek ISM43340 Wi-Fi module** via SPI + AT-command driver
  (NOT LwIP — the Wi-Fi module owns the IP stack)
- coreMQTT (vendored, MIT) over a custom transport that calls the
  ISM43340 socket API
- jsmn for JSON parsing
- **No dynamic allocation in steady state**

### Infra (`infra/`)
- Docker Compose for local dev (server + mosquitto + dashboard + caddy)
- Docker Compose for production on RPi
- Plant Wi-Fi network configured to allow STM32 → RPi traffic on 1883
- Optionally: LXC alternative

---

## Architecture (one-paragraph summary)

The STM32 is a thin client connected to the plant Wi-Fi via the on-board
Inventek ISM43340 module. It renders a TouchGFX UI whose content is driven
by a `DefectConfig` model received over MQTT. The QC responsable edits
defects in the React dashboard, which calls FastAPI, which writes to
SQLite and publishes a retained MQTT message on `qc/config/defects`.
Mosquitto pushes that message to every connected STM32; the firmware
parses the JSON, persists it to Octo-SPI flash, and rebinds the UI.
Defect logs flow the other direction: operator taps a button → STM32
publishes on `qc/device/{id}/defect` (QoS 1) → MQTT bridge writes the
row to SQLite → dashboard sees it on next query. Offline: STM32 queues
to Octo-SPI flash and drains on reconnect.

---

## Wi-Fi Operational Considerations

Wi-Fi is operationally riskier than wired Ethernet on a plant floor.
We accept that risk for PoC velocity, with mitigations:

- **Dedicated SSID** for the QC system if possible — separates traffic
  from corporate Wi-Fi, avoids credential rotation pain
- **Static IP for the RPi (broker)** — STM32 firmware has the broker
  address baked into config; if DHCP changes the broker's IP, devices
  stop working
- **WPA2-PSK** (not enterprise) — simplest credential model that's still
  secure on a closed industrial network
- **Site survey before pilot** — verify RSSI at every inspection station
  is comfortably above the module's reliable-operation threshold
  (typically > -65 dBm). Painting equipment is electrically noisy.
- **Offline queue is non-negotiable** — Wi-Fi will drop. Document the
  cap: 1000 queued logs (~24h of typical use)
- **Connection-status indicator** visible to the operator on every screen

If the pilot reveals Wi-Fi reliability issues, the platform abstraction
makes swapping to a W5500 Ethernet shield (Arduino-shield form factor)
a contained change: only `platform_net.c` and a few build flags.

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
├── docs/           # Architecture, API spec, MQTT topics, ADRs
├── scripts/        # Deploy, backup, dev helpers
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
- Multi-arch builds: `linux/amd64` (dev laptop) + `linux/arm64` (RPi)
- Image tags semver per component (`qc-server:0.1.0`), `latest` only on `main`

LXC is supported as an alternative isolation mechanism on the RPi.

---

## Feature Flags & Configuration Hierarchy

A consistent pattern across all components:

1. **Build-time flags** — change rarely, often platform-specific.
   - Server/dashboard: env vars at image build (rare)
   - Firmware: C macros in `app_config.h`, set via `-D` in build system
2. **Runtime config** — change per deployment, not per request.
   - Server/dashboard: env vars at container start
   - Firmware: config struct loaded from Octo-SPI flash at boot
3. **Live-toggleable flags** — change without redeploy/reflash.
   - Server: DB-backed `feature_flags` table, cached in memory
   - Firmware: pushed via MQTT `qc/config/flags` (retained)

Document every flag in `docs/feature-flags.md`.

---

## Conventions

- **Commits:** Conventional Commits format. Small, focused commits.
- **Branches:** `main` is always deployable. Feature branches `feat/<phase>-<desc>`.
- **Versioning:** Semver per component. PoC starts at 0.1.0.
- **Logs:** Structured (JSON) on server. Plain text on firmware (ITM/SWO).
- **Secrets:** `.env` files (gitignored), `.env.example` documents required vars.
  Wi-Fi PSK and MQTT credentials provisioned per-device, stored in Octo-SPI.
- **Time:** UTC everywhere on the wire. Display in local time (Europe/Paris)
  only in the dashboard UI layer.

---

## Do NOT

- Do not hardcode IPs, hostnames, ports, or file paths anywhere in source.
- Do not introduce a second backend language. Python only on the server.
- Do not bring LwIP into the firmware. The Wi-Fi module owns the IP stack;
  introducing LwIP duplicates it.
- Do not use raw HTTP from the STM32 for defect logs. MQTT only.
- Do not allocate dynamically in firmware steady-state code paths.
- Do not bypass the retained-message pattern for config. The STM32 must
  be usable with cached config on first boot before MQTT connects.
- Do not commit binaries, build artifacts, `node_modules`, or `.env` files.
- Do not write business logic inside TouchGFX View classes. Views render;
  Presenters decide; Models hold state.
- Do not install services natively on the RPi if a container exists for them.
- Do not store Wi-Fi credentials in source. They live in Octo-SPI config
  flashed at provisioning time.

---

## When Helping Me, Prefer

- Concrete code over explanation, when the design is already decided.
- Pointing at existing files in the repo over generating new ones.
- Asking one clarifying question if a request is ambiguous, not three.
- Following the existing patterns in the nearest sibling file.
- Generating tests alongside non-trivial code changes.
- Surfacing principle violations explicitly.

---

## Build & Run Commands

### Full stack (local dev)
```bash
docker compose -f infra/docker-compose.dev.yml up --build
```

### Server / dashboard / firmware
See per-component `CLAUDE.md`.

### Deploy to RPi
```bash
./scripts/deploy.sh           # ships compose stack to RPi
./scripts/backup-db.sh        # snapshot SQLite to ./backups/
./scripts/provision-device.sh # generate MQTT + Wi-Fi creds for a new STM32
```

---

## Status

Currently in: **Phase 2 — Dashboard** (Phase 1 server foundation complete,
audited in `docs/audits/phase-1-audit.md` and remediated across batches
1–3 of audit follow-up work). See `docs/roadmap.md`.
