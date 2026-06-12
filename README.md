# Painting QC

Digitalizes paper-based quality-control logging on a paint-finishing line.
Inspectors log part defects on a touch-optimised **web app (PWA)** running on a
station tablet; a Raspberry Pi server persists every inspection; a **web
dashboard** gives the QC responsable real-time analytics and configuration. A
wall-mounted STM32 shows live KPIs as an **andon board**.

## Architecture

Four pieces talk over the plant LAN:

| Component | Role | Stack |
|---|---|---|
| **dashboard** | Admin UI **and** the inspection PWA | React · Vite · TypeScript · TanStack Query · Tailwind · Caddy · Docker |
| **server** | API, persistence, KPIs | FastAPI · SQLAlchemy · SQLite (WAL) · paho-mqtt · Docker |
| **firmware** | Display-only KPI andon board | STM32H7B3I-DK · TouchGFX · FreeRTOS · ESP-01 Wi-Fi · C11 |
| **infra** | Broker, DNS, TLS, deploy | Mosquitto · dnsmasq · Caddy · Docker Compose |

Inspection flows **PWA → REST → SQLite**. Config flows **dashboard → server →
PWA** (picked up on the PWA's next fetch — no device push). The andon board
polls **`GET /kpi`** (or subscribes to a retained MQTT KPI snapshot) and renders
big numbers. See [docs/architecture.md](docs/architecture.md) for the full
picture and [docs/decisions.md](docs/decisions.md) ADR-017 for the pivot that
made the web the primary client.

```
[Inspector]                         [QC Responsable]
    │ tablet (kiosk)                     │ browser
    ▼                                    ▼
[Inspection PWA] ──POST /inspections──▶ [FastAPI] ──▶ [SQLite]
    ▲  offline queue (IndexedDB)          │  ▲
    └────── config on next fetch ─────────┘  │ GET /kpi
                                             ▼
                                    [STM32 andon board]  (display only)
```

## Quickstart (local dev)

Prerequisites: Docker with Compose. The full stack runs in containers — no host
Python/Node needed to run it.

```bash
cp infra/.env.example infra/.env
# edit infra/.env — set JWT_SECRET and MQTT_SERVER_PASSWORD at minimum
# bootstrap the Mosquitto password file once (see docs/deployment.md §5)
docker compose -f infra/docker-compose.dev.yml up --build
```

- Dashboard (admin): `http://localhost:8080` — inspection PWA at `/inspect.html`
- API: `http://localhost:8000` (OpenAPI at `/docs`)
- HTTPS (installable kiosk PWA, Caddy internal CA): `https://localhost`

The `dnsmasq` service is for the RPi only; skip it on a dev laptop
(`docker compose ... up <other services>` or scale it to 0).

### Tests

```bash
# server
cd server && pytest

# dashboard (typecheck + unit)
cd dashboard && pnpm install && pnpm exec tsc --noEmit && pnpm test
```

A VS Code devcontainer (`.devcontainer/`) provides Python 3.11, Node 20, GCC,
and a Mosquitto sidecar with zero host setup. Firmware GUI tooling
(STM32CubeIDE, TouchGFX Designer) stays on the host; only the host-buildable C
tests in `firmware/` run in-container.

### Firmware (andon board)

The live TouchGFX project is at `C:\TouchGFXProjects\qc_node` (outside this
repo). Open it in STM32CubeIDE, build, and flash the STM32H7B3I-DK over its
on-board ST-LINK. The board is **display-only**: it joins Wi-Fi via an external
ESP-01 (AT commands over UART) and polls `GET /kpi`. See
[firmware/CLAUDE.md](firmware/CLAUDE.md).

## Configuration

Copy `infra/.env.example` to `infra/.env`. Key variables:

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Token signing key — generate with `openssl rand -hex 32` |
| `MQTT_SERVER_PASSWORD` | Server's Mosquitto account password |
| `PLANT_NAME` | Display string in the dashboard (e.g. `Tunis Plant 1`) |
| `LOCALE` | UI locale, e.g. `fr-TN` |
| `QC_DOMAIN` | Friendly hostname for tablets (default `inspection.pmp`) |

See `infra/.env.example` for the full list, and
[docs/feature-flags.md](docs/feature-flags.md) / [docs/build-flags.md](docs/build-flags.md)
for toggleable behaviour.

## Deploy to the RPi

The stack runs on a Raspberry Pi 4B reached at `https://inspection.pmp` (dnsmasq
maps the name to the Pi's current DHCP IP; Caddy issues an internal-CA cert).
Full network, first-boot, and deploy steps are in
[docs/deployment.md](docs/deployment.md); kiosk setup in
[docs/runbook-kiosk.md](docs/runbook-kiosk.md).

## Docs

| File | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | System architecture + extension/integration seams |
| [docs/decisions.md](docs/decisions.md) | Architecture Decision Records (ADR-001 → 020) |
| [docs/api-spec.md](docs/api-spec.md) | REST API reference |
| [docs/data-model.md](docs/data-model.md) | Database schema |
| [docs/deployment.md](docs/deployment.md) | Network setup & deploy checklist |
| [docs/roadmap.md](docs/roadmap.md) | What shipped and what's next |
| [docs/principles.md](docs/principles.md) | Engineering principles and rationale |
| `server/CLAUDE.md` · `dashboard/CLAUDE.md` · `firmware/CLAUDE.md` · `infra/CLAUDE.md` | Per-component conventions |
