# Painting QC PoC — Day-by-Day Roadmap

42 days, solo, assuming ~6 focused hours/day. Multiply by 1.5–2× for part-time.

Format per day:
- **Goal:** what done looks like
- **Tasks:** concrete checklist
- **Claude Code prompts:** ready-to-use prompts for the trickier bits
- **Risks:** what might bite

Mark days with `🤖` where Claude Code is high-leverage, `🔧` where manual work
dominates (hardware, GUI design, in-person testing).

**Hardware:** Raspberry Pi 4B (server) + STM32H7B3I-DK (end device, with
on-board Inventek ISM43340 Wi-Fi module). **Network topology: Option A** —
RPi joins existing plant Wi-Fi via its on-board Wi-Fi, has a static IP or
DHCP reservation. STM32 connects to the same SSID. All MQTT traffic
transits the plant WLAN.

---

# Phase 0 — Foundation (Days 1–3)

## Day 1 🔧 — Hardware bring-up + plant Wi-Fi prep

**Goal:** Both devices powered. RPi on the plant Wi-Fi with a stable IP.
STM32 toolchain working. Wi-Fi module proven functional.

### Plant IT coordination (do this FIRST, ideally before Day 1)

Plant IT must confirm:
- [ ] **Static IP or DHCP reservation** for the RPi on the plant Wi-Fi
      (devices will have this address hard-provisioned)
- [ ] **Client-to-client traffic is allowed** on the SSID — many enterprise
      APs enable "client isolation" by default, which silently blocks
      STM32 → RPi traffic. This is the single most common reason an
      Option A deployment fails.
- [ ] **TCP port 1883 is not blocked** between WLAN clients (some networks
      restrict it as a known-IoT port)
- [ ] **WPA2-PSK is supported** (not enterprise-only WPA2-Enterprise / 802.1X
      — the ISM43340 driver supports WPA2-PSK; enterprise auth requires
      different module firmware and is out of scope for the PoC)
- [ ] **RSSI ≥ -65 dBm** at the planned inspection station (a quick site
      survey with a phone Wi-Fi analyzer suffices for now)

If any answer is "no" — fall back to a small dedicated AP plugged into
the RPi's Ethernet creating a "QC-Net" SSID. Document this as Plan B in
`docs/decisions.md`.

### Hardware setup

- [ ] Flash Raspberry Pi OS Lite 64-bit (Bookworm) to SD card with Imager,
      pre-configure: SSH on, hostname `qc-server`, user, locale, **plant
      Wi-Fi SSID + PSK** (Imager has fields for this)
- [ ] Boot RPi headless, SSH in over the plant Wi-Fi using the assigned
      static IP; `sudo apt update && sudo apt full-upgrade -y`
- [ ] Confirm RPi is reachable from your dev laptop on the same WLAN:
      `ping qc-server.local` or `ping <rpi-ip>`
- [ ] Install STM32CubeIDE and TouchGFX Designer on dev machine

### STM32 + Wi-Fi module verification

- [ ] Open the H7B3I-DK Clock & Weather demo project from STM32CubeH7
      (`Projects/STM32H7B3I-DK/Demonstrations/ClockAndWeather`)
- [ ] Edit the demo's `mbed_app.json` (or wherever SSID/PSK is set) to
      use your plant Wi-Fi credentials
- [ ] Build with STM32CubeIDE; when configuring debug, enable the
      **external loader** for the Octo-SPI flash (the demo stores assets
      there); manually select the correct loader for MX25LM51245G_STM32H7B3I-DK
- [ ] Flash & boot. We do NOT care that this is an HTTP server demo —
      we only need to see the module associate with the AP. Look for:
      1. Module firmware version logged on boot (record in
         `docs/firmware-versions.md` — expected: `C3.5.2.6.STM.BETA4`)
      2. Successful WPA2 association to plant SSID
      3. DHCP-assigned IP shown on screen or in SWO log
      4. `ping <stm32-ip>` from the RPi succeeds
- [ ] If association fails: check RSSI, double-check PSK, verify the
      SSID is 2.4 GHz (ISM43340 is 802.11 b/g/n single-band, no 5 GHz)

Risks:
- Plant IT delays are the most common Day 1 blocker. Reach out a week
  ahead. Have Plan B (dedicated AP) ready in case the SSID won't work.
- ISM43340 is **2.4 GHz only**. If the plant Wi-Fi exposes only a 5 GHz
  SSID at your station, you need a dual-band AP or a separate 2.4 GHz
  network. Verify before Day 1.
- The shipped module firmware `C3.5.2.6.STM.BETA4` has a documented
  "network scan only once" limitation. For *connecting* to a known SSID
  this likely does not matter (we never scan at runtime); for the
  Clock & Weather demo it does not block initial use. We'll stress-test
  reconnect on Day 18; firmware upgrade is reserved as a contingency.

---

## Day 2 🤖 — Repo skeleton & docs

**Goal:** Empty but correctly structured monorepo committed to GitHub.

Tasks:
- [ ] `gh repo create painting-qc --private`
- [ ] Create directory structure per project root `CLAUDE.md`
- [ ] Drop in all `CLAUDE.md` files (root + server + dashboard + firmware +
      infra)
- [ ] Drop in `docs/principles.md`
- [ ] Write initial `docs/data-model.md`, `docs/api-spec.md`,
      `docs/mqtt-topics.md`, `docs/decisions.md`, `docs/build-flags.md`,
      `docs/feature-flags.md`
- [ ] Initialize `.gitignore` (Python, Node, STM32 build artifacts)
- [ ] First commit: `chore: initial repo structure and docs`

**Claude Code prompt:**
> Read CLAUDE.md and docs/principles.md, then draft docs/data-model.md,
> docs/api-spec.md, docs/mqtt-topics.md, docs/decisions.md,
> docs/build-flags.md, docs/feature-flags.md per the Day 2 tasks.
> Reference each other consistently.

---

## Day 3 🔧🤖 — Server base install

**Goal:** RPi has all needed services installed (not yet running our code).

Tasks:
- [ ] `sudo apt install docker.io docker-compose-plugin git`
- [ ] Add user to `docker` group, reboot
- [ ] Configure Wi-Fi network per the Day 1 decision; verify STM32 demo
      can reach the RPi's IP via `ping` from a laptop on the same network
- [ ] Test: `docker run hello-world` succeeds on RPi
- [ ] Generate Mosquitto config files in `infra/mosquitto/` (mosquitto.conf,
      acl.conf, passwd template)
- [ ] Document network setup in `docs/deployment.md`

**Claude Code prompt:**
> Generate infra/mosquitto/mosquitto.conf and infra/mosquitto/acl.conf
> for the topic structure in docs/mqtt-topics.md. Server account
> publishes to qc/config/#, subscribes to qc/device/+/#. Device account
> qc-device-001 publishes only to qc/device/qc-stm32-001a2b3c/#,
> subscribes only to qc/config/# and its own /cmd. Include retained-
> message persistence and reasonable defaults.

Risks: Mosquitto ACL syntax is finicky. Test with `mosquitto -c <conf> -v`
in foreground before enabling the container.

---

# Phase 1 — Server Foundation (Days 4–7)

## Day 4 🤖 — FastAPI skeleton + DB models + Docker

**Goal:** Server starts in Docker, `/health` responds, schema migrated.

Tasks:
- [ ] `cd server && uv init` and add dependencies (fastapi, uvicorn,
      sqlalchemy, alembic, pydantic-settings, paho-mqtt, argon2-cffi,
      pyjwt, loguru, pytest, pytest-asyncio, httpx)
- [ ] Create folder structure per `server/CLAUDE.md`
- [ ] Implement `app/config.py` with Pydantic Settings
- [ ] Implement `app/db.py` with engine and `get_session` dependency
- [ ] Implement all SQLAlchemy models matching `docs/data-model.md`
- [ ] `alembic init alembic`, configure, autogenerate first migration
- [ ] `app/main.py` with FastAPI app factory and `/health` route
- [ ] Write multi-stage `server/Dockerfile`
- [ ] Write `infra/docker-compose.dev.yml` with server + mosquitto services
- [ ] Smoke test: `docker compose up`, then `curl localhost:8000/health`
- [ ] Write `pytest` config + one passing test on `/health`

**Claude Code prompt:**
> Read server/CLAUDE.md, docs/data-model.md. Scaffold the FastAPI server.
> Generate SQLAlchemy 2.0 declarative models for every table in the data
> model with proper indexes, foreign keys, active/archived_at columns.
> Use Mapped[] annotations. Generate Alembic init and a first revision.
> Then write a multi-stage Dockerfile (builder stage with uv, slim
> runtime, non-root user, healthcheck). Then write
> infra/docker-compose.dev.yml with server + mosquitto + volumes +
> healthchecks + a shared qc-net network.

Risks: SQLAlchemy 2.0 syntax differs from 1.x. Ensure modern `Mapped[]`
style. Docker buildx may need arm64 verification later.

---

## Day 5 🤖 — Auth + operator/defect CRUD

**Goal:** All resources have working CRUD endpoints, JWT auth works.

Tasks:
- [ ] `app/security.py`: argon2 hash/verify, JWT encode/decode
- [ ] `app/routers/auth.py`: `/auth/login`, `/auth/me`
- [ ] `app/routers/operators.py`: full CRUD, PIN set endpoint
- [ ] `app/routers/defect_categories.py`: full CRUD
- [ ] `app/routers/defect_types.py`: full CRUD with 12-per-category cap
- [ ] `app/routers/devices.py`: read-only list, single detail
- [ ] Seed script `scripts/seed_dev.py`
- [ ] pytest tests for happy paths + the cap rule

---

## Day 6 🤖 — MQTT bridge

**Goal:** Mosquitto ↔ FastAPI integration working both directions.

Tasks:
- [ ] `app/mqtt/bridge.py`: paho-mqtt client, started from FastAPI
      `lifespan`, clean shutdown
- [ ] `app/mqtt/handlers.py`: handler for `qc/device/+/defect` → writes
      `defect_logs`; handler for `qc/device/+/status` → upserts `devices`
- [ ] `app/mqtt/publisher.py`: `publish_defect_config()` and
      `publish_operators()` building JSON from current DB state
- [ ] Wire publisher calls into defect_type and operator services
- [ ] Hand-test: `mosquitto_pub` from inside the mosquitto container →
      verify DB rows appear

**Claude Code prompt:**
> Implement app/mqtt/bridge.py running paho-mqtt in a separate thread,
> started from FastAPI lifespan. On message, dispatch to the right
> handler in handlers.py via topic pattern matching. Each handler
> creates its own DB session, commits, closes. Add reconnect with
> backoff. Mock the paho client in one pytest test.

### Day 6 side task: CI setup (see ADR-012)

- [x] Create `.github/workflows/ci.yml` running server pytest + ruff
      and dashboard vitest on every push
- [x] Create `.github/workflows/build-images.yml` building multi-arch
      Docker images on main + tags, pushing to ghcr.io
- [x] Add `ruff` and `mypy` to `server/pyproject.toml` dev deps
- [ ] Run `uv lock` from `server/` to generate `server/uv.lock`
      (required for `uv sync --frozen` in CI)
- [ ] Verify first CI run passes (green badge on README)
- [ ] Generate a GHCR PAT (`read:packages`), `docker login ghcr.io`
      on the RPi once

---

## Day 7 🤖 — Stats endpoints + tests

**Goal:** Dashboard has all the data it needs.

Tasks:
- [ ] `app/routers/stats.py` (summary, by-defect, by-operator, heatmap)
- [ ] `app/routers/defect_logs.py`: list with filters + CSV export
- [ ] Round out test coverage to ~60% on services
- [ ] Commit & tag `server-v0.1.0`

---

# Phase 2 — Dashboard (Days 8–12) ✅ Complete

## Day 8 🤖 — Frontend scaffold + auth ✅

**Goal:** Vite app boots inside Docker, login works against server.

Tasks:
- [x] `pnpm create vite@latest dashboard -- --template react-ts`
- [x] Install all deps from `dashboard/CLAUDE.md`
- [x] `src/config.ts` reading from `window.__APP_CONFIG__`
- [x] `src/api/client.ts` axios instance with interceptors
- [x] `src/hooks/useAuth.tsx` provider + hook
- [x] `src/pages/Login.tsx` working against `/auth/login`
- [x] `src/components/RequireAuth.tsx` route guard
- [x] Multi-stage Dockerfile: node builder → Caddy runtime
- [x] Add dashboard service to `docker-compose.dev.yml`
- [x] `infra/caddy/Caddyfile.dev` serving dashboard + reverse-proxying
      `/api/*` to server

---

## Day 9 🤖 — Defect types & operators pages ✅

**Goal:** QC responsable can manage all configuration.

Tasks:
- [x] `pages/DefectTypes.tsx` with 12-per-category visible counter
- [x] `pages/Operators.tsx` with PIN set dialog
- [x] `pages/DefectCategories.tsx`
- [x] Optimistic updates with TanStack Query
- [x] Toasts for all mutations
- [x] One Vitest smoke test per page

---

## Day 10 🤖 — Logs & analytics ✅

**Goal:** QC responsable can see data and patterns.

Tasks:
- [x] `pages/Logs.tsx` with filters, CSV export, pagination
- [x] `pages/Analytics.tsx`: daily count, top defects, heatmap,
      hour-of-day distribution
- [x] Reusable date range picker

---

## Day 11 🤖 — Devices page + dashboard home ✅

**Goal:** Status visibility.

Tasks:
- [x] `pages/Devices.tsx` with online/offline, RSSI if exposed, config
      version, last-seen
- [x] `pages/Dashboard.tsx` (home) with stat tiles + recent logs feed
- [x] Navigation sidebar
- [x] Settings page stub

---

## Day 12 🤖🔧 — Polish + integration test ✅

**Goal:** Dashboard feels finished. Manual E2E test passes.

Tasks:
- [x] Seed script written and verified (`scripts/seed_dev.py`)
- [ ] Walk through every page at the deployed URL (not localhost)
- [ ] Use `mosquitto_pub` to inject fake defect logs, watch dashboard
- [ ] Fix visual/UX issues
- [ ] Test on tablet-sized screen
- [ ] Tag a release: `git tag v0.1.0 && git push --tags`
- [ ] Run `QC_VERSION=v0.1.0 ./scripts/deploy.sh pi@<rpi-ip>`
- [ ] Verify dashboard at `http://<rpi-ip>/`
- [ ] Commit & tag `dashboard-v0.1.0`

Phase 2 audit findings beyond Batch 1 (3 × 🔴 blockers + test infra +
seed script) are deferred to `docs/post-poc-todo.md` per PoC scope
discipline. Phase 3 begins.

---

# Phase 3 — STM32 UI Mockup (Days 13–17)

## Day 13 🔧 — TouchGFX project & screen skeletons

**Goal:** TouchGFX project with all screens defined (empty).

Tasks:
- [ ] Open TouchGFX Designer, new project from H7B3I-DK template
- [ ] Define screens: splash, login, productRef, defects, summary
- [ ] Set up navigation
- [ ] Define color palette and shared text style
- [ ] Place TouchGFX framebuffer in SDRAM (the H7B3 has 16 MB, use it)
- [ ] Generate code, build, flash. Tap through empty screens.

Risks: TouchGFX Designer has a learning curve. Half-day of fumbling
expected. H7B3I-DK template configures SDRAM correctly out of the box —
do not modify.

---

## Day 14 🔧🤖 — Login screen

**Goal:** Working numeric keypad and PIN flow with hard-coded operators.

Tasks:
- [ ] Design login screen: title, plant logo, 4 PIN dots, numeric keypad
- [ ] `LoginPresenter` handles PIN buffer, hard-coded operator check
- [ ] Operator name shown briefly between login and productRef

**Claude Code prompt:**
> In firmware/TouchGFX/gui/src/login_screen/, implement the PIN logic
> per firmware/CLAUDE.md. Hard-code 3 operators in Model.cpp. Presenter
> holds the buffer; View renders filled dots via setDigitCount(int).

---

## Day 15 🔧🤖 — Defect grid screen

**Goal:** 2-column defect grid with hard-coded config rendering correctly.

Tasks:
- [ ] In Designer: 2 containers, 12 button slots each (4×3 grid)
- [ ] Top header: operator, product ref, defect count, sync icon
- [ ] `DefectsView::refresh()` reads model, binds labels + visibility
- [ ] `DefectsPresenter` handles taps, logs to in-RAM array
- [ ] Confirmation toast component

**Claude Code prompt:**
> Implement DefectsView::refresh() reading presenter->getConfig() and
> binding 24 pre-placed buttons (btnCat1_0..btnCat1_11, btnCat2_0..
> btnCat2_11). For each visible defect, set the TextArea buffer via
> Unicode::strncpy and invalidate(). Hide unused slots. Maintain
> slotToDefectId[24] for tap handlers.

---

## Day 16 🔧 — Remaining screens & polish

Tasks:
- [ ] Splash, productRef, summary screens
- [ ] Persistent error banner for offline state
- [ ] Sync icon (placeholder for now)

---

## Day 17 🔧 — Operator usability test

**Goal:** Real human feedback before networking.

Tasks: as before — schedule 30 min, observe silently, capture findings
in `docs/usability-test-1.md`, fix top 2–3 issues.

---

# Phase 4 — STM32 Networking & MQTT (Days 18–24)

**Note:** This phase is rewritten for Wi-Fi via the Inventek ISM43340.
The original wired-Ethernet plan was higher-risk; the Wi-Fi path is
actually simpler because the module owns the IP stack.

## Day 18 🤖🔧 — Wi-Fi module driver bring-up (with reconnect test)

**Goal:** STM32 connects to the plant AP, opens a TCP client socket to
the RPi, reconnects cleanly after a disconnect. The `net.h` API is
implemented; everything above it is transport-agnostic.

### Source the ST Network Library and es-wifi BSP driver from CubeH7

The H7B3I-DK Cube package already includes both the ST Network Library
and the es-wifi BSP driver. Together they provide a socket-style API
over the Inventek module. We vendor both into our repo for stability;
we do NOT depend on the global CubeH7 install path.

Tasks:
- [ ] Download STM32CubeH7 (v1.12.1 or later) from ST
- [ ] Copy `Middlewares/ST/STM32_Network_Library/` into our
      `firmware/Middlewares/ST/STM32_Network_Library/`
- [ ] Copy `Drivers/BSP/Components/es-wifi/` (es_wifi.c/h) into our
      `firmware/Drivers/BSP/Components/es-wifi/`
- [ ] Copy the I/O glue file from the H7B3I-DK Clock-and-Weather demo
      (`net_conf_es_wifi_spi.c/h`) as a starting point — this is the
      board-specific layer we'll customize
- [ ] In CubeMX: enable SPI2 for the Wi-Fi module per H7B3I-DK
      schematic (verify SB18/19, SB21/22, SB23/24, SB25/26 are in
      default position for SPI2 — see `firmware/CLAUDE.md` Wi-Fi
      specifics). Configure DATRDY (PI5, EXTI), RST (PI1), WKUP (PI2),
      GPIO (PI4) pins.
- [ ] Adapt `net_conf_es_wifi_spi.c` for our SPI2 instance — this is
      the only board-specific surgery needed. Pin macros only; no
      protocol changes.
- [ ] Add a `decisions.md` reference: `Day 18: adopted ST Network
      Library (ADR-011)`.

Note: the H7B3I-DK Clock-and-Weather demo is an HTTP *server*. We are
not using its application logic; only its driver-level files (es-wifi
BSP + SPI I/O glue) which are correctly configured for our board's
pinout.

### Implement `net.h` as a thin shim over the ST Network Library

- [ ] Create `Application/net/net_wifi_ism43340.c` as a shim mapping
      our `net.h` API to the ST Network Library API:
      - `net_init()` → calls `net_if_init()` from the Network Library,
        passes our SSID/PSK struct through
      - `net_connect_ap()` → calls Network Library's interface-up call
        on the es-wifi adapter
      - `net_disconnect_ap()` → analogous interface-down
      - `net_socket_open()` → wraps `net_sock_create()`
      - `net_socket_connect()` → wraps `net_sock_open()` (the Network
        Library's "open" is what POSIX calls "connect")
      - `net_socket_send/recv()` → wrap `net_sock_send/recv()` with
        POSIX-style behavior on partial transfers
      - `net_socket_close()` → wraps `net_sock_close()`
      - Reconnect orchestration: own it in this file or in `net_task.c`;
        the Network Library will not retry by itself
      - On every state change, set the matching FreeRTOS event bit
- [ ] Hard-code SSID/PSK temporarily (moves to provisioning Day 23)

### Test progression (each step must pass before next)

- [ ] **Test 1 — Association:** boot, `net_connect_ap()` returns OK,
      `net_get_ip()` returns a non-zero IP. Log via SWO.
- [ ] **Test 2 — TCP client one-shot:** on RPi run `nc -l 9000`.
      From firmware: open socket, connect to `<rpi-ip>:9000`, send
      "hello", close. Verify text appears on RPi's `nc` output.
- [ ] **Test 3 — Reconnect after disconnect** (CRITICAL):
      ```
      open → send → close → open again → send "hello2" → close
      ```
      Verify both messages arrive. **This is where the scan-once
      firmware limitation would bite us if it affects connect**, so
      we test it explicitly before depending on the module.
- [ ] **Test 4 — Reconnect after AP loss:** kill the AP (or block the
      MAC briefly), wait for `EVT_WIFI_DISCONNECTED`, restore the AP,
      verify `EVT_WIFI_CONNECTED` fires within 60s. Then run Test 2
      again — sockets work.
- [ ] **Test 5 — Long-haul:** open socket, send 1 byte/sec for 10
      minutes, verify no drops.

### If Test 3 or 4 fails — firmware upgrade contingency

If the shipped `C3.5.2.6.STM.BETA4` firmware can't reconnect cleanly,
upgrade to `C6.2.1.11.E` per UM2569 section 7.6.12 (~half day):
- Remove R30 and R32 (0Ω resistors)
- Wire SWDIO from R30-right to TP4
- Wire SWCLK from R32-right to TP5
- Flash the Inventek `.bin` via STM32CubeProgrammer through the on-board
  ST-LINK-V3E
- Reverse the wiring afterward
- Update `docs/firmware-versions.md`
- Re-run Tests 3, 4, 5

Risks:
- SPI2 vs SPI3 vs SPI4 confusion is real — multiple ST examples are
  for different boards. The schematic is the source of truth.
- The L4S5I es-wifi driver may include sleep/wake-up logic that
  doesn't apply to our use case. Strip it down to client-socket only;
  we don't need power management on a wall-powered device.
- `WIFI_OpenClientConnection()` semantics differ subtly across driver
  versions. Test return codes; some report "connected" before the
  module finishes the handshake.

This day was the riskiest in the original wired-Ethernet plan. With
the Wi-Fi module owning the IP stack, the *technical* risk is lower
but **driver compatibility risk** replaces it. Test 3 is the
go/no-go gate.

**Claude Code prompt:**
> Read firmware/CLAUDE.md. Implement Application/net/net_wifi_ism43340.c
> as a thin shim mapping the net.h API to the ST Network Library
> (vendored at Middlewares/ST/STM32_Network_Library/). Do not call the
> es-wifi BSP driver directly — go through the Network Library, which
> already wraps it. Track link state in a static flag and signal
> FreeRTOS events EVT_WIFI_CONNECTED / EVT_WIFI_DISCONNECTED on
> transitions. Implement exponential backoff reconnect orchestration
> here (the Network Library does not retry on its own); after 5
> consecutive failures, toggle the WIFI_RST GPIO before retrying.
> SSID/PSK come from the net_config_t struct passed to net_init(). Do
> not hardcode any strings. Wrap any non-POSIX behaviors of the Network
> Library's send/recv (e.g., blocking instead of EAGAIN, partial writes
> reported as errors) so our net_socket_send/recv behave POSIX-like.

---

## Day 19 🤖 — SNTP + device identity

**Goal:** STM32 knows its own ID and the current time.

Tasks:
- [ ] Implement `device_id()` returning a stable lowercase hex string
      from STM32 UID (`HAL_GetUIDw0/1/2`)
- [ ] Implement SNTP client in `Application/net/sntp_client.c` using
      `net.h` socket API (NOT a Wi-Fi-module-specific call — keep
      transport-agnostic)
- [ ] Sync to RPi's NTP service, set RTC
- [ ] Log time periodically, confirm it matches RPi

---

## Day 20 🤖 — coreMQTT integration

**Goal:** Client connects, subscribes, publishes status.

Tasks:
- [ ] Vendor coreMQTT as a submodule under `Middlewares/coreMQTT`
- [ ] Implement `Application/mqtt/mqtt_transport.c` for coreMQTT,
      using `net.h` (NOT the Wi-Fi module driver directly)
- [ ] `mqtt_task.c`: connect loop with exponential backoff
- [ ] Publish `qc/device/<id>/status` every 30s (QoS 0)
- [ ] Subscribe to `qc/config/defects`, `qc/config/operators`,
      `qc/device/<id>/cmd` (QoS 1)
- [ ] Smoke test: Mosquitto logs show subscriptions

**Claude Code prompt:**
> Generate firmware/Application/mqtt/mqtt_task.c using coreMQTT.
> Transport via Application/mqtt/mqtt_transport.c calling net_socket_*
> functions. Single FreeRTOS task. State machine: DISCONNECTED →
> CONNECTING → CONNECTED → DISCONNECTED on error. Reconnect with
> exponential backoff (cap 30s). While CONNECTED, MQTT_ProcessLoop
> with 1000ms timeout. Status publish via a 30s xTimer signaling a
> queue. Wait on EVT_WIFI_CONNECTED before first connect attempt.

Risks: coreMQTT's transport interface is just function pointers for
`send` and `recv`. Mapping to `net_socket_send/recv` is straightforward
(~50 lines). Be careful about how the Wi-Fi module reports partial
sends and timeouts — wrap them to behave like POSIX sockets.

---

## Day 21 🤖 — JSON parsing & config application

**Goal:** Receiving `qc/config/defects` updates the live UI.

Tasks:
- [ ] Vendor jsmn (`Middlewares/jsmn`)
- [ ] Implement `Application/domain/defect_config.c`: parse JSON into
      a stack-allocated struct, validate every field, return error
      codes
- [ ] On valid parse: copy to model (mutex-protected), set
      `EVT_CONFIG_UPDATED`
- [ ] GUI task observes event, calls `currentScreen->refresh()`
- [ ] End-to-end test: modify a defect label in dashboard → see it on
      STM32 within seconds

**Claude Code prompt:**
> Implement Application/domain/defect_config.c using jsmn. Strict
> parser: max 24 categories, max 24 defects, label max 24 chars.
> Reject on missing field, wrong type, oversize. Return negative error
> codes from app_errors.h. Generate a host-side test harness in
> firmware/tests/ running against 5 fixture JSON files (valid,
> missing field, extra field, oversize label, bad type). The parser
> code must compile against both APP_TARGET_STM32H7B3 and
> APP_TARGET_HOST unchanged.

---

## Day 22 🤖 — Defect log publish

**Goal:** Tapping a defect button puts a row in the SQLite DB.

Tasks:
- [ ] `DefectsPresenter`: on tap, build a `defect_log_t`, push to
      publish queue
- [ ] `mqtt_task`: drain publish queue, format JSON, publish QoS 1
- [ ] Server side: confirm `defect_logs` row appears, dashboard shows
      it within seconds
- [ ] Measure end-to-end latency (tap → DB row): target <1000 ms on
      Wi-Fi

Note: Wi-Fi latency is typically 50–200 ms in good conditions, vs
~10–50 ms on wired Ethernet. Still well within usability.

---

## Day 23 🤖 — Provisioning, persistent config, operator list

**Goal:** STM32 boots usable with cached config. Credentials are
provisioned per-device, not hardcoded.

Tasks:
- [ ] Implement `Application/persistence/config_store.c`: read/write
      `DefectConfig`, `OperatorList`, and `WiFiCredentials` to Octo-SPI
      at fixed offsets, with magic + version + CRC32
- [ ] On boot, before Wi-Fi: load all three from flash, populate model
- [ ] On valid MQTT config receive: write back to flash if version
      changed (defect config and operators only — Wi-Fi creds are write-
      once at provisioning)
- [ ] Move operator check from hard-coded list to the model
- [ ] PIN hash compare (sha256 + salt for PoC; argon2 if cycle count
      acceptable)
- [ ] Implement `scripts/provision-device.sh` on server side:
      1. Generate Wi-Fi creds + MQTT creds for the device
      2. Output a binary blob to be flashed at a known Octo-SPI offset
         via STM32CubeProgrammer
      3. Add MQTT creds to Mosquitto ACL

**Claude Code prompt:**
> Implement Application/persistence/config_store.c. Octo-SPI is memory-
> mapped at 0x90000000. Writes go through octospi_driver.c which
> temporarily unmaps, programs, and remaps. Layout per
> firmware/CLAUDE.md memory map. Three records: defect_config (16 KB),
> operator_list (16 KB), wifi_credentials (4 KB). Each has magic +
> version + length + CRC32 header. Provide read/write/validate
> functions. Generate a host test using a file-backed fake.

Risks: Octo-SPI write/erase requires unmapping memory-mapped mode.
Get this wrong and you corrupt running code if assets are in Octo-SPI.
For the PoC, place TouchGFX assets in internal flash (we have 2 MB, that's
plenty) to avoid this risk entirely. Read ST's AN5050.

---

## Day 24 🤖 — Sync indicator + connection UX

**Goal:** UI accurately reflects network and broker state.

Tasks:
- [ ] Sync status icon: 3 states (red disconnected, amber connected to
      Wi-Fi but no MQTT, green fully connected)
- [ ] Connection state events from `net_task` and `mqtt_task` → event
      group → GUI redraws icon
- [ ] Show RSSI value somewhere accessible (small text in corner or
      diagnostic screen). Useful for plant-floor signal-strength debug.
- [ ] Disable "Start Inspection" if no config has ever been received
- [ ] Test: walk away from AP, watch icon degrade; come back, watch it
      recover

---

# Phase 5 — Resilience & Polish (Days 25–30)

## Day 25 🤖 — Offline queue

**Goal:** Defect logs survive disconnected periods and replay in order.

Tasks:
- [ ] `Application/persistence/defect_queue.c`: circular buffer in
      Octo-SPI, ~1000 entries × 64 bytes
- [ ] On publish failure or while disconnected: append
- [ ] On reconnect: drain in order, wait for QoS 1 puback before
      advancing tail
- [ ] Queue depth visible in sync icon
- [ ] Test: kill Wi-Fi (`net_disconnect_ap()` from a debug command),
      log 20 defects, restore Wi-Fi, verify all 20 arrive in DB

**Claude Code prompt:**
> Implement Application/persistence/defect_queue.c as a power-loss-safe
> circular buffer in Octo-SPI. Use double-buffered head/tail pointers
> in their own sector with sequence numbers; pick the higher sequence
> on boot. 64-byte fixed records. queue_push/peek/pop/depth. Host
> tests simulating power loss mid-write.

Risks: Wi-Fi will drop more often than wired Ethernet would have. The
queue is more important here than in the original plan.

---

## Day 26 🤖 — Watchdog + recovery

**Goal:** Self-recovery from hangs.

Tasks:
- [ ] IWDG at 8s timeout, kicked from `wdg_task` which waits on each
      other task's heartbeat queue
- [ ] If any task fails to check in within 6s, watchdog stops kicking → reset
- [ ] On reset: log "recovered from watchdog reset" (read RCC reset
      flags before clearing)
- [ ] Special case: if Wi-Fi module hangs (DRDY pin stuck), watchdog
      resets the whole MCU — but also expose `platform_wifi_module_reset()`
      to allow a softer recovery first

---

## Day 27 🤖 — Server hardening

Same as before. SQLite WAL, daily backup, log rotation, healthcheck
endpoint, retained messages survive Mosquitto restart.

---

## Day 28 🤖🔧 — Security pass

**Goal:** PoC-appropriate security baseline.

Tasks:
- [ ] Each STM32 has its own MQTT credentials in Octo-SPI (provisioning)
- [ ] Each STM32 has its own Wi-Fi credentials in Octo-SPI (provisioning) —
      enables per-device WPA2 PSK rotation later, or migration to WPA-
      Enterprise if needed
- [ ] Mosquitto ACL: each device username restricted to own topics
- [ ] Caddy in front of FastAPI with self-signed cert
- [ ] Operator PINs hashed (argon2 or sha256+salt) — never logged
- [ ] Audit code for any `printf` of secrets
- [ ] `.env.example` finalized

Note: Wi-Fi traffic on the plant network is not encrypted end-to-end
beyond WPA2. For the PoC this is acceptable; for production, enable
`APP_FEATURE_MQTT_TLS=1` and provision per-device certificates.

---

## Day 29 🔧 — End-to-end stress test

**Goal:** Confirm failure modes are clean.

Tasks:
- [ ] **Wi-Fi outage:** kill the AP, log 30 defects, restore, verify all 30
- [ ] **Power cut on STM32:** verify no flash corruption, queue intact
- [ ] **Power cut on RPi:** boot back up, retained config still arrives
- [ ] **Config change while STM32 offline:** STM32 reconnects, immediately
      receives new config via retained message
- [ ] **RSSI degradation:** physically move farther from AP, observe
      reconnect behavior — document min usable RSSI
- [ ] **24-hour soak test:** overnight, monitor heap, reconnect count

---

## Day 30 🤖🔧 — Documentation & demo prep

Tasks:
- [ ] `README.md` with screenshots and quickstart
- [ ] `docs/deployment.md` covering Wi-Fi network setup
- [ ] `docs/operator-guide.md` — one-page printable
- [ ] `docs/qc-guide.md` — for the responsable
- [ ] `docs/wifi-troubleshooting.md` — RSSI, reconnect, diagnostic
      screen usage
- [ ] 3-minute screen+phone demo video
- [ ] Tag `v0.1.0-pilot-ready`

---

# Phase 6 — Field Pilot (Days 31–42)

## Day 31 🔧 — Plant deployment

Tasks:
- [ ] Mount STM32 in temporary enclosure at one inspection station
- [ ] **Site survey first** — measure RSSI from the chosen location to
      the AP. If < -70 dBm, move the AP or add a repeater before going
      live. Painting equipment is electrically noisy; signal margin
      matters.
- [ ] Provision device: flash with unique Wi-Fi + MQTT creds, MAC-
      registered in router if isolation is desired
- [ ] RPi in QC office, on UPS if possible
- [ ] Operator can log in, full flow works in situ
- [ ] Print quick-start sheet, tape next to station

---

## Day 32–35 🔧 — Shadow + iterate

As before. Note any Wi-Fi-specific issues (reconnect events, dropped
defects ending up in offline queue) and address.

---

## Day 36 🔧 — QC responsable training

As before.

---

## Day 37–40 🔧 — Hands-off observation

Pay extra attention to Wi-Fi reliability metrics in the dashboard
(devices page should show reconnect count per device).

---

## Day 41 🔧 — Pattern analysis

As before — the value proposition test.

---

## Day 42 🔧 — Decision day

Same three possible outcomes as the original plan, plus a fourth
specific to Wi-Fi choice:

1. **Scale** to more stations on same architecture
2. **Productionize** with proper enclosures, redundancy
3. **Pivot hardware** (e.g., RPi-based stations for v2)
4. **Switch transport to wired** — if Wi-Fi reliability proved
   inadequate, swap to W5500 Ethernet shield. Thanks to `net.h`
   abstraction, this is a ~3-day change, not a rewrite.

---

# Working with Claude Code — Daily Rituals

**Start of session:** Give Claude Code a one-line context with current day.

**Before generating code:** Make sure relevant `CLAUDE.md` and `docs/*.md`
are up to date. Outdated context → plausible-looking wrong code.

**After generating code:** Always read it. Especially firmware — silent
bugs cost hours.

**End of session:** Ask for a summary of changes + what's next, paste
into `TODO.md`.

**Weekly:** Review the week's commits against the roadmap and
`docs/decisions.md`. Catch drift early.

---

# Scope-Cut Options if Behind Schedule

Priority order — drop bottom first:

1. Stats heatmap → keep top defects + daily count only
2. CSV export → defer
3. Settings page → defer
4. Watchdog task → defer (rely on systemd + manual restart)
5. argon2 PIN hash → use sha256+salt
6. Power-loss-safe queue → use simple non-atomic queue
7. argon2 for dashboard passwords → use bcrypt
8. Two-device test → defer

Never cut:
- The Phase 3 Day 17 usability test
- The Phase 6 Day 32 shadow day
- The Phase 6 Day 41 pattern analysis
- **The Day 31 site survey** — added for the Wi-Fi path

---

## Demo sprint (4 weeks from 2026-05-19)

Following ADR-013 (product-scoped model). Concrete sub-plan for the
1-month live demo. Supersedes the day-by-day roadmap above for active
work; the day-by-day roadmap remains as reference for tasks not yet done.

### Week 1 (Days 1–5) — Model rework

- Documentation updates (committed alongside this roadmap entry)
- Alembic migration: drop `defect_categories`, add `products`,
  reshape `defect_types` (product_id + category_kind), add `note`
  and `product_id` to `defect_logs`
- Server: new routers (`products`, `constants`), update
  `defect_types` router to product-scoped paths, update MQTT
  publisher to emit `qc/config/products` (schema_version 2),
  update MQTT handler to accept defect payloads with `product_id`
- Dashboard: adapt existing pages to new model (no redesign);
  add `ProductsPage` and `ProductDetailPage`
- Seed script regenerated for new model

### Week 2 (Days 6–12) — Firmware integration

- MQTT subscription updated: `qc/config/defects` → `qc/config/products`
- Defect publish updated: schema_version 2, `product_id` + `note`
- Session topic: publish `qc/device/{id}/session` on product selection
- TouchGFX screens: splash, login, product selection, defect grid,
  summary (product selection is the new screen vs. old flow)
- First end-to-end: operator selects product, taps defect →
  log row appears in dashboard with correct `product_id`

### Week 3 (Days 13–18) — Rich dashboard

- Hourly real-time stat tiles
- Live defect feed with auto-refresh
- Drill-down: stat tile → filtered logs
- Product detail with sync indicator
- Charts: hourly trends, per-product, per-defect type, percentages

### Week 4 (Days 19–25) — Integration, dry runs, buffer

- Three full demo dry runs minimum (operator + QC responsable roles)
- Polish issues discovered during dry runs
- Buffer days for surprises
