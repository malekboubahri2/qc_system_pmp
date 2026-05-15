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
on-board Inventek ISM43340 Wi-Fi module). Network: STM32 connects to plant
Wi-Fi; RPi sits on the same network with a static IP.

---

# Phase 0 — Foundation (Days 1–3)

## Day 1 🔧 — Hardware bring-up

**Goal:** Both devices powered. RPi on the LAN. STM32 toolchain working.
Wi-Fi connectivity verified.

Tasks:
- [ ] Flash Raspberry Pi OS Lite 64-bit (Bookworm) to SD card with Imager,
      pre-configure SSH, hostname `qc-server`, user, locale
- [ ] Boot RPi, SSH in, `sudo apt update && sudo apt full-upgrade -y`
- [ ] Set static IP via `/etc/dhcpcd.conf` or `nmcli`. Document the IP.
- [ ] **Decide Wi-Fi network topology** for the PoC:
      - Option A: RPi joins existing plant Wi-Fi (simplest, requires IT)
      - Option B: A cheap travel router on RPi's Ethernet creates a
        dedicated "QC-Net" SSID (more isolated, fewer dependencies)
      - Option C: RPi acts as the AP via hostapd (most control,
        highest setup effort)
- [ ] Install STM32CubeIDE (latest) and TouchGFX Designer on dev machine
- [ ] Open the H7B3I-DK out-of-box demo in CubeIDE, build, flash via
      ST-Link. Confirm display works and touch responds.
- [ ] **Verify Wi-Fi module presence:** flash one of the STM32CubeH7
      Wi-Fi demos (e.g., the HTTP server example) for H7B3I-DK to confirm
      the ISM43340 module works and connects to the chosen Wi-Fi network.
- [ ] Note the Wi-Fi module firmware version visible in demo output —
      document in `docs/firmware-versions.md`

Risks: The ISM43340's firmware version matters. Older versions are
flaky. If the OOB demo connects unreliably, update the module firmware
using ST's tool before going further.

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

---

## Day 7 🤖 — Stats endpoints + tests

**Goal:** Dashboard has all the data it needs.

Tasks:
- [ ] `app/routers/stats.py` (summary, by-defect, by-operator, heatmap)
- [ ] `app/routers/defect_logs.py`: list with filters + CSV export
- [ ] Round out test coverage to ~60% on services
- [ ] Commit & tag `server-v0.1.0`

---

# Phase 2 — Dashboard (Days 8–12)

## Day 8 🤖 — Frontend scaffold + auth

**Goal:** Vite app boots inside Docker, login works against server.

Tasks:
- [ ] `pnpm create vite@latest dashboard -- --template react-ts`
- [ ] Install all deps from `dashboard/CLAUDE.md`
- [ ] `src/config.ts` reading from `window.__APP_CONFIG__`
- [ ] `src/api/client.ts` axios instance with interceptors
- [ ] `src/hooks/useAuth.tsx` provider + hook
- [ ] `src/pages/Login.tsx` working against `/auth/login`
- [ ] `src/components/RequireAuth.tsx` route guard
- [ ] Multi-stage Dockerfile: node builder → Caddy runtime
- [ ] Add dashboard service to `docker-compose.dev.yml`
- [ ] `infra/caddy/Caddyfile.dev` serving dashboard + reverse-proxying
      `/api/*` to server

---

## Day 9 🤖 — Defect types & operators pages

**Goal:** QC responsable can manage all configuration.

Tasks:
- [ ] `pages/DefectTypes.tsx` with 12-per-category visible counter
- [ ] `pages/Operators.tsx` with PIN set dialog
- [ ] `pages/DefectCategories.tsx`
- [ ] Optimistic updates with TanStack Query
- [ ] Toasts for all mutations
- [ ] One Vitest smoke test per page

---

## Day 10 🤖 — Logs & analytics

**Goal:** QC responsable can see data and patterns.

Tasks:
- [ ] `pages/Logs.tsx` with filters, CSV export, pagination
- [ ] `pages/Analytics.tsx`: daily count, top defects, heatmap,
      hour-of-day distribution
- [ ] Reusable date range picker

---

## Day 11 🤖 — Devices page + dashboard home

**Goal:** Status visibility.

Tasks:
- [ ] `pages/Devices.tsx` with online/offline, RSSI if exposed, config
      version, last-seen
- [ ] `pages/Dashboard.tsx` (home) with stat tiles + recent logs feed
- [ ] Navigation sidebar
- [ ] Settings page stub

---

## Day 12 🤖🔧 — Polish + integration test

**Goal:** Dashboard feels finished. Manual E2E test passes.

Tasks:
- [ ] Run seed script on RPi server
- [ ] Walk through every page at the deployed URL (not localhost)
- [ ] Use `mosquitto_pub` to inject fake defect logs, watch dashboard
- [ ] Fix visual/UX issues
- [ ] Test on tablet-sized screen
- [ ] Build production images, push to RPi
- [ ] Commit & tag `dashboard-v0.1.0`

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

## Day 18 🤖🔧 — Wi-Fi module driver bring-up

**Goal:** STM32 connects to AP, gets an IP, can `ping` the RPi.

Tasks:
- [ ] In CubeMX: enable SPI4 (or whichever SPI is wired to the Wi-Fi
      module on H7B3I-DK — check schematic), enable the DRDY GPIO with
      EXTI interrupt
- [ ] Vendor ST's Network Library from STM32CubeH7
      (`Middlewares/ST/STM32_Network_Library`) OR use ST's WIFI BSP
      driver for ISM43340
- [ ] Implement `Application/platform/platform_stm32h7b3.c` glue for
      SPI transactions to the Wi-Fi module
- [ ] Implement `Application/net/net_wifi_ism43340.c` wrapping the
      driver in the `net.h` API
- [ ] Hard-code SSID/PSK temporarily (move to provisioning Day 23)
- [ ] On boot: connect to AP, log assigned IP via SWO
- [ ] Add a simple TCP test: open a socket to RPi:9000, send "hello"
- [ ] On RPi: `nc -l 9000` → see "hello"
- [ ] Confirm `ping <stm32-ip>` from RPi succeeds

**Claude Code prompt:**
> Implement Application/net/net_wifi_ism43340.c implementing the API in
> net.h. Wrap calls to ST's WIFI BSP driver (or the Network Library's
> socket layer). Track link state in a static flag; emit FreeRTOS
> events EVT_WIFI_CONNECTED / EVT_WIFI_DISCONNECTED. Implement
> exponential backoff reconnect. Read SSID/PSK from a struct passed at
> init — do NOT hardcode strings.

Risks: Wi-Fi module firmware version matters. If connection is flaky:
1. Verify module firmware version (community reports older versions
   fail to associate)
2. Check RSSI — too far from AP causes intermittent issues
3. Verify SPI clock isn't too high — start at 10 MHz, increase if stable

This day was the riskiest in the original wired plan. With Wi-Fi via
the ISM43340, the risk is reduced because the module handles MAC, PHY,
TCP, and DHCP for us — no LwIP, no cache-coherency issues.

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
