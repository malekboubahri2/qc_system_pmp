# Painting QC Digitalization — Project Context

> This file is read automatically by Claude Code on every session in this repo.
> Keep it concise, factual, and current. Update when architecture changes.

---

## What This Project Is

A proof-of-concept system that digitalizes paper-based quality control logging
in a paint finishing plant. Inspectors log defects in a touch-optimised **web
app (PWA) on a station tablet** instead of writing on paper sheets; the QC
responsable configures products and defect types and monitors patterns in real
time from the **web dashboard**. A repurposed STM32 acts as a wall-mounted
**KPI "andon" board** showing live Taux NC / parts inspected for the room.

> **Architecture pivot (ADR-017).** The inspection client was originally an
> STM32 + TouchGFX terminal; it is now a web PWA, and the STM32 is demoted to
> the KPI board. The **web dashboard + inspection PWA are the product's primary
> surface and main selling point** — invest in a rich, interactive, animated UI.
> See `docs/decisions.md` ADR-017 and `docs/roadmap.md`.

The PoC must demonstrate three things:
1. Inspectors can log defects at least as fast as on paper.
2. The QC responsable can configure defect types from the web and see them
   appear in the inspection app within seconds.
3. The dashboard surfaces patterns (by time, defect type, operator) that
   would be invisible on paper.

---

## Hardware

- **Server:** Raspberry Pi 4B 8GB, Raspberry Pi OS Lite 64-bit (Bookworm).
  On the plant LAN/Wi-Fi, static IP. Runs the full stack (FastAPI + SQLite +
  Mosquitto + dashboard, all in Docker).
- **Inspection client:** a touch-optimised **web PWA** (no custom hardware)
  running on a **wall/stand-mounted Android tablet per station**, kiosk-locked
  and on a powered mount. This replaces the STM32 inspection terminal (ADR-017).
- **KPI andon board:** the repurposed **STM32H7B3I-DK** Discovery kit
  (STM32H7B3LIH6Q Cortex-M7 @ 280 MHz, 4.3" 480×272 touch LCD, 16 MB SDRAM,
  64 MB Octo-SPI, on-board ST-LINK-V3E) on a wall. It only **displays** big KPI
  numbers — no input. Wi-Fi via an external **ESP-01 (ESP8266)** over UART (AT
  commands; the module owns the IP stack — ADR-015), *not* the on-board
  ISM43340. Default transport: HTTP poll of `GET /kpi`; MQTT subscribe optional.

Network: tablets and the andon board join the plant Wi-Fi; the RPi is on the
same network at a fixed IP. Tablets reach the server over HTTPS (via Caddy);
the andon board reaches `/kpi` (HTTP) or Mosquitto (MQTT) at the fixed IP.

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

### Dashboard (`dashboard/`) — admin UI **and** the inspection PWA
- React 18 + TypeScript + Vite. Hosts both the QC-responsable admin dashboard
  and the touch-optimised **inspection PWA** (`features/inspect/`, kiosk layout
  for station tablets). The web UI is the product's primary surface and selling
  point — invest in interactivity, animation, and polish.
- TailwindCSS + shadcn/ui, TanStack Query, React Router v6, Zod, Recharts
- **PWA:** service worker + manifest (installable, fullscreen/kiosk), IndexedDB
  offline inspection queue, online/pending indicator
- **Docker** multi-stage → Caddy-served static bundle (Caddy also terminates
  TLS for the tablet→server hop)

### Firmware (`firmware/`) — KPI andon board only (ADR-017)
- STM32CubeIDE + STM32CubeMX (HAL), TouchGFX 4.x, FreeRTOS (CMSIS-RTOS2)
- Wi-Fi via external **ESP-01 (ESP8266)** over UART/AT (ADR-015) — NOT LwIP,
  the module owns the IP stack
- **Display-only:** fetches KPIs (default: HTTP `GET /kpi`; option: MQTT
  subscribe to `qc/display/kpi` via vendored coreMQTT) and renders big numbers.
  No input flow, no offline queue, no SNTP.
- The live project is at `C:\TouchGFXProjects\qc_node`; the retired
  inspection-terminal build is history (see ADR-015/016/017).

### Infra (`infra/`)
- Docker Compose for local dev (server + mosquitto + dashboard + caddy)
- Docker Compose for production on RPi
- Plant Wi-Fi/LAN allowing tablets (HTTPS) and the andon board (HTTP/1883) → RPi
- Optionally: LXC alternative

---

## Architecture (one-paragraph summary)

Inspectors use a touch-optimised **web PWA** (a slice of the React dashboard)
on a station tablet: they pick their name + PIN (verified server-side), select
a product, tap defects across the PMP and INJECTION grids — rendered
dynamically from the product's defect-type config fetched from the API — and
submit one **part inspection** (`POST /inspections`, schema 4). The QC
responsable manages products, defect types and operators in the same dashboard
(FastAPI → SQLite); config changes are picked up by the PWA on its next fetch,
no device push needed (ADR-013/016/017). A shared `services/inspections` module
expands each part into `inspection_logs` rows; the **same module** also backs
the legacy MQTT handler, so the contract is transport-agnostic. Offline, the
PWA queues parts in IndexedDB and drains on reconnect. A repurposed STM32
**andon board** polls `GET /kpi` (or subscribes to a retained `qc/display/kpi`)
and renders live Taux NC / parts inspected on the wall — display only.

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

## Inspection ingest & KPIs (post-ADR-017)

The **inspection path is now REST**: the PWA `POST`s a schema-4 part inspection
to `POST /inspections`. The MQTT inspection topics below are kept only for
backward compatibility (the retired STM32 terminal) — both transports call the
same `services/inspections` module.

## MQTT Topics (full spec in `docs/mqtt-topics.md`) — lightly used now

| Topic | Direction | QoS | Retained | Purpose |
|---|---|---|---|---|
| `qc/display/kpi` | server→board | 1 | yes | KPI snapshot for the andon board (optional; HTTP `GET /kpi` is the default) |
| `qc/config/products` | server→device | 1 | yes | Product list with per-product defect types (future device add-ons) |
| `qc/config/operators` | server→device | 1 | yes | Operator list with PIN hashes (future device add-ons) |
| `qc/device/{id}/status` | device→server | 0 | no | Heartbeat (if a device is present) |
| `qc/device/{id}/inspection` | device→server | 1 | no | **Legacy** — part inspection (schema 4); REST is now primary |
| `qc/device/{id}/session`, `…/cmd`, `…/defect` | both | 1 | varies | Legacy device topics |

`{id}` is a device hardware UID, lowercase hex, e.g. `qc-stm32-001a2b3c`.
Mosquitto is retained for future device add-ons; it is no longer on the
inspection critical path.

Schemas are versioned. Every payload includes a `schema_version` field.
Server and firmware both validate it and refuse unknown versions.

---

## Data Model (full spec in `docs/data-model.md`)

Tables: `products`, `defect_types`, `defect_logs`, `operators`,
`devices`, `users` (for dashboard auth).
`defect_categories` replaced by plant-wide constants in `app/constants.py`
(see ADR-013).

Hard rules:
- Never hard-delete rows. Use `active` (bool) and `archived_at` (timestamp).
- Every `defect_logs` row carries `device_id`, `operator_id`, `product_id`,
  `defect_type_id`, `note` (nullable), `logged_at` (device time),
  `received_at` (server time).
- Cap: 12 defects per `(product_id, category_kind)`, enforced server-side.
  Label ≤ 24 chars. One auto-managed "Other" fallback per pair.

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
- Do not bring LwIP into the firmware. The ESP-01 owns the IP stack;
  introducing LwIP duplicates it.
- Do not add an input/inspection flow back onto the STM32 — it is a
  **display-only KPI board** now (ADR-017). Inspection happens in the web PWA.
- Do not branch inspection logic per transport. REST (`POST /inspections`) and
  the legacy MQTT handler must both go through the one `services/inspections`.
- Do not allocate dynamically in firmware steady-state code paths.
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

Currently in: **Web-PWA pivot (ADR-017).** The inspection client is moving from
the STM32/TouchGFX terminal to a web PWA on station tablets; the STM32 becomes a
KPI andon board. Server, data model, auth, and dashboard are reused as-is.
Next: Phase 1 (one `services/inspections` behind both REST + MQTT; `POST
/inspections`, `POST /operators/verify-pin`, `GET /kpi`, a `station` role) →
inspection PWA MVP → offline/kiosk → andon board. See `docs/decisions.md`
ADR-017 and the rebuilt `docs/roadmap.md`.

**Product direction:** the web dashboard + inspection PWA are the primary
surface and selling point — prioritise interactive, animated, polished UX.
Planned features (backlog, see roadmap): PDF report generation; auto-generated
unique operator PINs (responsable enters a name → server mints a unique PIN,
shown once).
