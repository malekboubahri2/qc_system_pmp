# Painting QC

Embedded quality-control system for painting lines. Operators log defects on a
touchscreen STM32 device; a Raspberry Pi server persists them; a web dashboard
gives the QC responsable real-time analytics and controls configuration.

## Architecture

Three components talk over a local LAN:

| Component | Stack |
|---|---|
| **firmware** | STM32H750B-DK · TouchGFX · FreeRTOS · coreMQTT · C11 |
| **server** | FastAPI · SQLite · paho-mqtt · Docker (linux/arm64) |
| **dashboard** | React · Vite · TypeScript · TanStack Query · Caddy · Docker |

Mosquitto brokers all MQTT traffic. Configuration flows **server → STM32**
via retained messages. Defect logs flow **STM32 → server → SQLite**.

```
[Operator]                [QC Responsable]
    │                           │
    ▼                           ▼
[STM32 touchscreen]      [Dashboard (React)]
    │  MQTT publish              │  REST/HTTP
    ▼                           ▼
[Mosquitto] ──────── [FastAPI server] ──── [SQLite]
    │   MQTT retained
    └──────────────▶ [STM32 touchscreen]
```

## Quickstart

### Server + dashboard (dev)

Prerequisites: Docker with Buildx, pnpm, Node 20.

```bash
cp infra/.env.example infra/.env
# edit infra/.env — set JWT_SECRET and MQTT_PASSWORD at minimum
docker compose -f infra/docker-compose.dev.yml up --build
```

Dashboard: `http://localhost:5173`
API: `http://localhost:8000`

### Firmware

Open `firmware/PaintingQC.ioc` in STM32CubeMX to regenerate HAL if needed,
then build in STM32CubeIDE and flash:

```bash
# Flash via ST-Link
STM32_Programmer_CLI -c port=SWD -w firmware/build/PaintingQC.elf -rst

# Capture SWO logs (2 Mbit/s)
STM32_Programmer_CLI -c port=SWD -SWV portb=2000000
```

### Provision a new STM32

```bash
./infra/scripts/provision-device.sh <device-id>
```

Generates MQTT credentials and ACL entries for the device. Outputs the
credentials to flash into QSPI via the `config_store` module.

### Production deploy to RPi

```bash
# Build ARM64 images
docker buildx build --platform linux/arm64 -t qc-server:0.1.0 server/
docker buildx build --platform linux/arm64 -t qc-dashboard:0.1.0 dashboard/

# Deploy
./infra/scripts/deploy.sh production
```

## Configuration

Copy `infra/.env.example` to `infra/.env`. Required variables:

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Token signing key — generate with `openssl rand -hex 32` |
| `MQTT_HOST` / `MQTT_PORT` | Mosquitto address (default `mosquitto` / `1883`) |
| `MQTT_PASSWORD` | Server MQTT account password |
| `PLANT_NAME` | Display string in the dashboard (e.g. `Tunis Plant 1`) |
| `TIMEZONE` | e.g. `Africa/Tunis` |

See `infra/.env.example` for the full list including optional flags.

## Docs

| File | Contents |
|---|---|
| `docs/roadmap.md` | 42-day build plan |
| `docs/principles.md` | Engineering principles and rationale |
| `firmware/CLAUDE.md` | Firmware architecture, memory map, FreeRTOS tasks, conventions |
| `server/CLAUDE.md` | FastAPI structure, module dependency rules, testing |
| `dashboard/CLAUDE.md` | Feature-sliced React architecture, UI rules |
| `infra/CLAUDE.md` | Docker, Caddy, Mosquitto, provisioning |
