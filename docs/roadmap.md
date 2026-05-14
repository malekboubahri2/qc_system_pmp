# Painting QC PoC — Day-by-Day Roadmap

42 days, solo, assuming ~6 focused hours/day. Multiply by 1.5–2× for part-time.

Format per day:
- **Goal:** what done looks like
- **Tasks:** concrete checklist
- **Claude Code prompts:** ready-to-use prompts for the trickier bits
- **Risks:** what might bite

Mark days with `🤖` where Claude Code is high-leverage, `🔧` where manual work
dominates (hardware, GUI design, in-person testing).

---

# Phase 0 — Foundation (Days 1–3)

## Day 1 🔧 — Hardware bring-up

**Goal:** Both devices powered, on the LAN, pingable.

Tasks:
- [ ] Flash Raspberry Pi OS Lite 64-bit (Bookworm) to SD card with Imager,
      pre-configure SSH, hostname `qc-server`, user, locale, Wi-Fi off
- [ ] Boot RPi, SSH in, run `sudo apt update && sudo apt full-upgrade -y`
- [ ] Set static IP via `/etc/dhcpcd.conf` or `nmcli`. Document final IP.
- [ ] Install STM32CubeIDE (latest) and TouchGFX Designer on dev machine
- [ ] Open the H750B-DK out-of-box example in CubeIDE, build, flash via ST-Link.
      Confirm display works and touch responds.
- [ ] Plug STM32 Ethernet into same switch as RPi. Note STM32 will DHCP from
      the network's router — confirm it gets an address (from router admin
      or from the demo's network screen if it has one).
- [ ] `ping <stm32-ip>` from RPi succeeds.

Risks: STM32 Ethernet may not be enabled in the default demo firmware. If
ping fails, defer the network validation to Day 18 — focus first on toolchain.

---

## Day 2 🤖 — Repo skeleton & docs

**Goal:** Empty but correctly structured monorepo committed to GitHub.

Tasks:
- [ ] `gh repo create painting-qc --private`
- [ ] Create directory structure per project root `CLAUDE.md`
- [ ] Drop in the four `CLAUDE.md` files (root + server + dashboard + firmware)
- [ ] Write initial `docs/data-model.md` with full SQLite schema
- [ ] Write initial `docs/api-spec.md` listing every endpoint with example
      request/response
- [ ] Write initial `docs/mqtt-topics.md` with full topic table and JSON
      payload schemas
- [ ] Write `docs/decisions.md` recording all Phase 0 locked decisions as ADRs
- [ ] Initialize `.gitignore` (Python, Node, STM32 build artifacts)
- [ ] First commit: `chore: initial repo structure and docs`

**Claude Code prompt for the docs:**
> Read CLAUDE.md, then draft `docs/data-model.md` with the complete SQLite
> schema for the tables listed there. For each table give: CREATE TABLE
> statement, column purposes, indexes, and example INSERT. Then draft
> `docs/api-spec.md` with one endpoint per row including method, path,
> auth requirement, request body schema, response body schema, and example
> curl. Reference the data model. Finally draft `docs/mqtt-topics.md`
> with one section per topic including direction, QoS, retained flag,
> JSON payload schema, and example payload.

Risks: Over-engineering the docs. Keep each under 300 lines. They will evolve.

---

## Day 3 🔧🤖 — Server base install

**Goal:** RPi has all needed services installed (not yet running our code).

Tasks:
- [ ] `sudo apt install mosquitto mosquitto-clients caddy git python3-pip pipx`
- [ ] Install `uv`: `pipx install uv`
- [ ] Install Node 20 + pnpm (via nvm or NodeSource apt repo)
- [ ] Configure Mosquitto: enable persistence, listener on 1883 with auth,
      create `mosquitto_passwd` entries for `qc-server` (publisher) and
      `qc-device-template` (subscriber)
- [ ] Write `/etc/mosquitto/conf.d/qc.conf` with ACL referencing
      `/etc/mosquitto/acl.conf`
- [ ] Test: `mosquitto_sub` and `mosquitto_pub` round trip from RPi to itself
- [ ] Test: `mosquitto_pub` from dev laptop to RPi works
- [ ] Document the Mosquitto config in `docs/deployment.md`

**Claude Code prompt:**
> Generate `/etc/mosquitto/conf.d/qc.conf` and `/etc/mosquitto/acl.conf`
> for the topic structure in `docs/mqtt-topics.md`. Server account
> publishes to `qc/config/#`, subscribes to `qc/device/+/#`. Device
> account `qc-device-001` publishes only to `qc/device/qc-stm32-001a2b3c/#`,
> subscribes only to `qc/config/#` and `qc/device/qc-stm32-001a2b3c/cmd`.
> Include retained-message persistence and reasonable defaults.

Risks: Mosquitto ACL syntax is finicky. Test with `mosquitto -c <conf> -v` in
foreground before enabling the systemd service.

---

# Phase 1 — Server Foundation (Days 4–7)

## Day 4 🤖 — FastAPI skeleton + DB models

**Goal:** Server starts, `/health` responds, schema migrated, no business logic yet.

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
- [ ] Smoke test: `uv run uvicorn app.main:app` and `curl /health`
- [ ] Write `pytest` config + one passing test on `/health`

**Claude Code prompt:**
> Read `server/CLAUDE.md` and `docs/data-model.md`. Scaffold the FastAPI
> server with the listed structure. Generate SQLAlchemy 2.0 declarative
> models for every table in the data model, with proper indexes, foreign
> keys, and `active`/`archived_at` columns where the doc requires them.
> Use `Mapped[]` annotations and `mapped_column()`. Then generate the
> Alembic init and a first revision. Finally write a pytest fixture that
> gives each test a fresh in-memory SQLite session, and a single test
> asserting `/health` returns 200.

Risks: SQLAlchemy 2.0 syntax differs from 1.x. Ensure Claude Code uses
modern `Mapped[]` style.

---

## Day 5 🤖 — Auth + operator/defect CRUD

**Goal:** All resources have working CRUD endpoints, JWT auth works.

Tasks:
- [ ] `app/security.py`: argon2 hash/verify, JWT encode/decode
- [ ] `app/routers/auth.py`: `/auth/login` (returns JWT), `/auth/me`
- [ ] `app/routers/operators.py`: full CRUD, PIN set endpoint
- [ ] `app/routers/defect_categories.py`: full CRUD
- [ ] `app/routers/defect_types.py`: full CRUD with 12-per-category server-side check
- [ ] `app/routers/devices.py`: read-only list, single detail
- [ ] Seed script `scripts/seed_dev.py` creating 1 admin user, 2 categories,
      a few defect types, 3 operators
- [ ] pytest tests for happy paths + the 12-per-category cap

**Claude Code prompt:**
> Implement `app/routers/defect_types.py` with full CRUD. Use the
> services pattern: router validates input via Pydantic, calls
> `services.defect_types.create/update/list/get/archive`, service
> handles SQL and enforces the 12-per-category rule by raising
> `BusinessRuleError` if violated. Map that to HTTP 409 in a global
> handler. Generate matching pytest tests including the cap rule.

Risks: Forgetting to enforce the cap in *update* (moving a defect into a
full category) — Claude Code will likely only cover create unless prompted.

---

## Day 6 🤖 — MQTT bridge

**Goal:** Mosquitto ↔ FastAPI integration working both directions.

Tasks:
- [ ] `app/mqtt/bridge.py`: paho-mqtt client connecting on app startup,
      shutdown clean
- [ ] `app/mqtt/handlers.py`: handler for `qc/device/+/defect` writes a
      `defect_logs` row; handler for `qc/device/+/status` upserts `devices`
      row with `last_seen`
- [ ] `app/mqtt/publisher.py`: `publish_defect_config()` and
      `publish_operators()` building the JSON payloads from current DB state
- [ ] Wire `publisher` calls into defect_type and operator services
- [ ] Test by hand: `mosquitto_pub -t qc/device/test-01/status ...` and
      verify DB row appears
- [ ] Test the other way: PATCH a defect type, run `mosquitto_sub -t qc/config/defects`
      in another terminal, verify retained message published

**Claude Code prompt:**
> Implement `app/mqtt/bridge.py` running paho-mqtt in a separate thread,
> started from FastAPI's `lifespan` context. On message, dispatch to the
> right handler in `handlers.py` based on topic pattern matching. Each
> handler creates its own DB session, commits, closes. Add reconnect-with-
> backoff. Generate one pytest test using a mock paho client.

Risks: paho-mqtt's threading model can deadlock with asyncio. Easiest pattern:
let paho run its own thread loop, never `await` inside handlers.

---

## Day 7 🤖 — Stats endpoints + tests

**Goal:** Dashboard has all the data it needs. Server phase done.

Tasks:
- [ ] `app/routers/stats.py`:
      - `GET /stats/summary?days=7` → daily counts
      - `GET /stats/by-defect?days=30` → top defects
      - `GET /stats/by-operator?days=30` → defect counts by operator
      - `GET /stats/heatmap?days=30` → hour-of-day × defect counts
- [ ] `app/routers/defect_logs.py`: list endpoint with filters (date range,
      operator_id, defect_type_id, device_id) + CSV export
- [ ] Round out test coverage to ~60% on services
- [ ] systemd service file in `scripts/qc-server.service`
- [ ] Commit & tag `server-v0.1.0`

**Claude Code prompt:**
> Generate the stats endpoints listed in `docs/api-spec.md`. Use
> SQLAlchemy's `func` for aggregation. For the heatmap, group by
> `strftime('%H', logged_at)` and `defect_type_id`. Return shapes
> exactly as documented in api-spec.md so the dashboard can rely on them.

Risks: SQLite's date functions differ from Postgres. Stick to `strftime`,
test with realistic data.

---

# Phase 2 — Dashboard (Days 8–12)

## Day 8 🤖 — Frontend scaffold + auth

**Goal:** Vite app boots, login page works against the server.

Tasks:
- [ ] `pnpm create vite@latest dashboard -- --template react-ts`
- [ ] Install Tailwind, shadcn/ui init, TanStack Query, axios, react-router,
      react-hook-form, zod, sonner, date-fns, recharts
- [ ] `src/api/client.ts` axios instance with interceptors (auth header,
      401 redirect to login)
- [ ] `src/hooks/useAuth.tsx` provider + hook
- [ ] `src/pages/Login.tsx` working against `/auth/login`
- [ ] `src/components/RequireAuth.tsx` route guard
- [ ] Empty `Dashboard.tsx` showing "logged in as {user}" — confirm full
      round trip works

**Claude Code prompt:**
> Read `dashboard/CLAUDE.md`. Scaffold the API client and auth provider.
> JWT lives in memory (state in AuthProvider), refresh token in
> httpOnly cookie set by server (we'll add cookie support to server
> later — for now just localStorage as a stopgap, but document the TODO).
> Generate `Login.tsx` using react-hook-form + zod, shadcn Form components,
> sonner toast on error.

---

## Day 9 🤖 — Defect types & operators pages

**Goal:** QC responsable can manage all configuration.

Tasks:
- [ ] `src/pages/DefectTypes.tsx` — table with inline add/edit, deactivate
      with confirm dialog, **12-per-category counter visible**
- [ ] `src/pages/Operators.tsx` — table with add/edit, PIN set dialog
      (4-digit numeric, confirm twice)
- [ ] `src/pages/DefectCategories.tsx` — simple list, edit category names only
- [ ] Optimistic updates with TanStack Query mutations
- [ ] Toast on success/failure for every mutation
- [ ] One Vitest smoke test per page

**Claude Code prompt:**
> Generate `pages/DefectTypes.tsx`. Layout: page header with title and
> "Add defect" button, two side-by-side cards (one per category), each
> card shows current count (e.g. "8 / 12") in red when at cap. Add
> button is disabled at cap with tooltip explaining why. List rows have
> inline edit (label + active toggle) and a deactivate button (soft-delete).
> Use shadcn Card, Table, Dialog, Form, Switch. Hook into `useDefectTypes`,
> `useCreateDefectType`, `useUpdateDefectType`, `useArchiveDefectType` (all
> in `hooks/defect-types.ts`).

Risks: Optimistic updates with cap enforcement is tricky — if the optimistic
state would exceed 12, surface error before the server roundtrip.

---

## Day 10 🤖 — Logs & analytics

**Goal:** QC responsable can see data and patterns.

Tasks:
- [ ] `src/pages/Logs.tsx` — filterable table (date range with default
      last-7-days, operator dropdown, defect type dropdown, device dropdown),
      CSV export button, pagination (50 per page)
- [ ] `src/pages/Analytics.tsx`:
      - Daily defect count line chart (Recharts)
      - Top 10 defects bar chart
      - Operator × defect heatmap
      - Hour-of-day distribution
- [ ] Date range picker reusable component

**Claude Code prompt:**
> Generate `pages/Analytics.tsx` with four Recharts visualizations laid
> out in a responsive 2×2 grid. Data from the `/stats/*` endpoints via
> TanStack Query hooks. Each chart in its own card with a title, a
> period selector (7d/30d/90d) at top right, and a loading skeleton.
> For the heatmap, use a custom Recharts implementation or a simple
> table with color-graded cells (Tailwind bg-red-{intensity}).

Risks: Recharts heatmaps are awkward. A colored-cell HTML table is
often better than fighting the library.

---

## Day 11 🤖 — Devices page + dashboard home

**Goal:** Status visibility for the QC responsable.

Tasks:
- [ ] `src/pages/Devices.tsx` — list of devices, last seen, current config
      version, online/offline indicator (green if last_seen < 90s ago),
      polling every 10s via TanStack Query refetchInterval
- [ ] `src/pages/Dashboard.tsx` (home) — four stat tiles: today's defect count,
      defects this week, active devices, top defect this week. Recent logs
      feed (last 10) below.
- [ ] Navigation sidebar with all pages
- [ ] Settings page stub (change own password)

---

## Day 12 🤖🔧 — Polish + integration test

**Goal:** Dashboard feels finished. Manual end-to-end test passes.

Tasks:
- [ ] Run the seed script on the RPi server
- [ ] Walk through every page from the dashboard at `http://<rpi-ip>:8000`
      using the deployed server (not localhost)
- [ ] Use `mosquitto_pub` to inject fake defect logs, watch dashboard
      update in real time (poll-based — no websocket yet)
- [ ] Fix any visual or UX issues
- [ ] Test on a tablet-sized screen (the QC responsable might use one)
- [ ] Build production bundle: `pnpm build`, serve via Caddy on RPi
- [ ] Commit & tag `dashboard-v0.1.0`

Risks: Dashboard built for desktop may break on tablet. Test resolution
matters — Caddy needs to serve the SPA with fallback to `/index.html`.

---

# Phase 3 — STM32 UI Mockup (Days 13–17)

## Day 13 🔧 — TouchGFX project & screen skeletons

**Goal:** TouchGFX project created with all screens defined (empty).

Tasks:
- [ ] Open TouchGFX Designer, create new project from H750B-DK template
- [ ] Define screens: `screenSplash`, `screenLogin`, `screenProductRef`,
      `screenDefects`, `screenSummary`
- [ ] Set up navigation: splash → login → productRef → defects ↔ summary
- [ ] Define color palette (high contrast: white BG, dark blue accents,
      green/red for status), one shared text style
- [ ] Generate code, build, flash. Confirm you can tap through empty screens.

Risks: TouchGFX Designer has a learning curve. Plan for half-day of fumbling.

---

## Day 14 🔧🤖 — Login screen

**Goal:** Working numeric keypad and PIN flow with hard-coded operators.

Tasks:
- [ ] Design login screen in Designer:
      - Title "Painting QC" + plant logo
      - 4 PIN dots (Image widgets, swap source between empty/filled)
      - Numeric keypad 0–9 + clear + enter (use a Container with 12 Buttons)
- [ ] Custom code in `LoginPresenter.cpp/hpp`:
      - Handle digit taps, build PIN buffer
      - On 4 digits, check against hard-coded `{1234: "Mohammed"}` map
      - On match: store operator in `model`, navigate to productRef
      - On mismatch: show error toast, clear PIN
- [ ] Operator name appears briefly between login and productRef screen

**Claude Code prompt:**
> In `firmware/TouchGFX/gui/src/login_screen/LoginView.cpp` and the
> corresponding Presenter, implement the PIN logic per `firmware/CLAUDE.md`.
> Hard-code 3 operators (Mohammed/1234, Aïcha/5678, Karim/9999) in
> `Model.cpp` for now. The Presenter holds the buffer; the View renders
> filled-dot images based on Presenter state via `setDigitCount(int)`.

---

## Day 15 🔧🤖 — Defect grid screen (the big one)

**Goal:** 2-column defect grid with hard-coded config rendering correctly.

Tasks:
- [ ] In Designer, lay out screenDefects:
      - Top header: operator name, product ref, defect count badge,
        sync status icon
      - Two large containers side-by-side, each with 12 button slots
        in a 4×3 grid
      - Bottom: "Finish" button
- [ ] Make each button 100×60 px with text label centered
- [ ] In `DefectsView`: implement `refresh()` reading
      `model->getDefectConfig()` and binding labels + visibility
- [ ] In `DefectsPresenter`: handle button taps, log to a hard-coded
      in-RAM array (real publish comes Phase 4)
- [ ] Confirmation toast component (overlay container, auto-dismiss
      after 1.5s, slide-in animation)

**Claude Code prompt:**
> Read `firmware/CLAUDE.md`. Implement `DefectsView::refresh()` that
> reads `presenter->getConfig()` (a `DefectConfig` struct) and binds
> the 24 pre-placed buttons (named `btnCat1_0` through `btnCat1_11`
> and `btnCat2_0` through `btnCat2_11`). For each visible defect,
> set the corresponding TextArea buffer via `Unicode::strncpy` and
> `invalidate()`. Hide unused slots with `setVisible(false)`. Maintain
> a parallel array `slotToDefectId[24]` that the tap handler uses.

Risks: TouchGFX text buffers are wide chars. The `Unicode::strncpy` API
is mandatory — regular `strncpy` will silently produce garbage.

---

## Day 16 🔧 — Remaining screens & polish

**Goal:** Splash, product ref, summary, error states all working.

Tasks:
- [ ] Splash: animated logo + "Connecting..." text, auto-advance after 1s
      (will gate on real MQTT connect later)
- [ ] Product ref: alphanumeric on-screen keyboard (or simpler: 6-digit
      numeric for PoC), "Start Inspection" button
- [ ] Summary screen: defects logged this session in a scrollable list,
      "End Shift" and "New Product" buttons
- [ ] Persistent error banner component for "offline" state
- [ ] Sync status icon (placeholder for now — colored circle)

Risks: Alphanumeric on-screen keyboards in TouchGFX are tedious. Numeric-only
for product ref is a reasonable PoC scope.

---

## Day 17 🔧 — Operator usability test

**Goal:** Real human user feedback before investing in networking.

Tasks:
- [ ] Schedule 30 min with an actual operator or production supervisor
- [ ] Set up the STM32 at their workstation, on a table at realistic height
- [ ] Pre-load with realistic defect labels (get from QC responsable)
- [ ] Have them go through a fake inspection while you observe silently
- [ ] Capture: tap accuracy, time vs paper, points of confusion, fonts
      legible at distance, anything they say out loud
- [ ] Brief debrief: "What would make this faster than paper?"
- [ ] Document findings in `docs/usability-test-1.md`
- [ ] Spend remaining time fixing the top 2–3 issues found

Risks: This is the single most important day in the project. Resist the urge
to "demo" — be quiet, watch, take notes. Friction here predicts adoption failure.

---

# Phase 4 — STM32 Networking & MQTT (Days 18–24)

## Day 18 🔧 — LwIP + Ethernet bring-up

**Goal:** STM32 has a working IP stack on the LAN.

Tasks:
- [ ] In CubeMX: enable ETH peripheral, LwIP middleware, DHCP, SNTP
- [ ] Configure interrupt priorities (LwIP needs `tcpip_thread`)
- [ ] In code: implement `net_task.c` that brings up LwIP after FreeRTOS starts
- [ ] On link-up, log assigned IP via SWO
- [ ] Implement a tiny TCP echo test: open port 7, echo bytes
- [ ] From RPi: `nc <stm32-ip> 7` → type, see echo
- [ ] If ping/TCP fails: check link LEDs, switch MAC config, RX descriptor
      alignment in D2 SRAM

Risks: H7 + LwIP is notorious for cache coherency issues. The Ethernet
descriptors must be in an uncached SRAM region (D2 SRAM via MPU config or
linker). Many tutorials are wrong. Use ST's `STM32CubeH7` reference example
as ground truth.

---

## Day 19 🔧🤖 — SNTP + identity

**Goal:** STM32 knows its own ID and the current time.

Tasks:
- [ ] Implement `device_id()` returning a stable lowercase hex string
      derived from STM32 UID (`HAL_GetUIDw0/1/2`)
- [ ] Configure LwIP SNTP client pointing at RPi
- [ ] Verify time sync: log `time(NULL)` periodically, confirm it matches RPi
- [ ] Set time on RTC (BKP-backed) so it survives soft resets

**Claude Code prompt:**
> Implement `app/device_id.c/h`: a function returning `"qc-stm32-XXXXXXXX"`
> where X = lowercase hex of the lower 32 bits of the chip UID. Cache the
> result in BSS after first call. Then implement `sntp_task.c` that
> initializes LwIP's SNTP at boot, syncs to the host in `config.h`, and
> calls a callback that sets the RTC.

---

## Day 20 🤖 — coreMQTT integration

**Goal:** Client connects, subscribes, publishes status.

Tasks:
- [ ] Vendor coreMQTT (git submodule under `Middlewares/coreMQTT`)
- [ ] Implement transport interface (LwIP raw sockets or Netconn API)
- [ ] `mqtt_task.c`: connect loop with exponential backoff
- [ ] Publish `qc/device/<id>/status` every 30s (QoS 0)
- [ ] Subscribe to `qc/config/defects`, `qc/config/operators`,
      `qc/device/<id>/cmd` (QoS 1)
- [ ] On connect: log "MQTT connected" via SWO
- [ ] Smoke test: server's `mosquitto` log shows the subscription

**Claude Code prompt:**
> Generate `firmware/Application/mqtt_task.c` using coreMQTT and LwIP
> netconn API for transport. Single FreeRTOS task. State machine:
> DISCONNECTED → CONNECTING → CONNECTED → DISCONNECTED on error.
> Reconnect with exponential backoff capped at 30s. While CONNECTED,
> loop calling `MQTT_ProcessLoop` with a 1000 ms timeout. Status
> publish handled via a 30s xTimer that signals via a queue.

Risks: coreMQTT's transport interface is generic — you must write the
LwIP glue. This is ~150 lines of careful code (send, recv with timeout,
clean close).

---

## Day 21 🤖 — JSON parsing & config application

**Goal:** Receiving `qc/config/defects` updates the live UI.

Tasks:
- [ ] Vendor jsmn (`Middlewares/jsmn`)
- [ ] Implement `config_parse.c`: parse JSON payload from MQTT into a
      stack-allocated `DefectConfig` struct, validate all fields,
      return 0 on success
- [ ] On valid parse: copy to model (mutex-protected), set event group bit
      `CONFIG_UPDATED`
- [ ] GUI task observes event group, calls `currentScreen->refresh()`
- [ ] End-to-end test: modify a defect label in dashboard → see it on STM32
      within a couple seconds

**Claude Code prompt:**
> Implement `config_parse.c` using jsmn. Parser is strict: max 24
> categories, max 24 defects, label max 24 chars including null. Reject
> on any field missing or wrong type. Return negative error codes from
> `app_errors.h`. Generate a host-side test harness in `firmware/tests/`
> that runs the parser against 5 fixture JSON files (valid, missing field,
> extra field, oversize label, bad type).

Risks: jsmn returns tokens, not parsed values. The parser is ~200 lines of
careful index walking. Test thoroughly off-target before integrating.

---

## Day 22 🤖 — Defect log publish

**Goal:** Tapping a defect button on STM32 puts a row in the SQLite DB.

Tasks:
- [ ] `DefectsPresenter`: on button tap, build a `defect_log_t` (operator id,
      defect id, product ref, timestamp, device id) and push to publish queue
- [ ] `mqtt_task`: drain publish queue, format JSON, publish QoS 1 on
      `qc/device/<id>/defect`
- [ ] On server side: confirm `defect_logs` row appears, visible in
      dashboard's Recent Logs feed
- [ ] Measure end-to-end latency (tap → DB row): should be <500 ms

---

## Day 23 🤖 — Persistent config + operator list

**Goal:** STM32 boots into a usable UI before MQTT connects, using cached config.

Tasks:
- [ ] Implement `config_store.c`: write/read `DefectConfig` and `OperatorList`
      to QSPI flash at fixed offsets, with magic number + version + CRC32
- [ ] On boot, before MQTT: load both from flash, populate model
- [ ] On valid MQTT config receive: write back to flash if version changed
- [ ] Move operator check from hard-coded list to the model's `OperatorList`
- [ ] Hash compare for PIN (argon2 ON STM32 — verify cycle count is acceptable;
      fallback to sha256(pin+salt) if argon2 is too slow)

**Claude Code prompt:**
> Implement `config_store.c/h`. QSPI is memory-mapped at `0x90800000`.
> Write functions use the QSPI driver's program/erase APIs (not memory-
> mapped writes). Layout: 4-byte magic, 4-byte version, 4-byte length,
> 4-byte CRC32, payload. Reserve 64 KB for config_defects, 64 KB for
> config_operators. Implement erase-sector-then-program semantics. Verify
> by reading back through memory-mapped region.

Risks: QSPI write/erase requires unmapping memory-mapped mode, writing,
remapping. Get this wrong and you can corrupt running code if assets are
also in QSPI. Read ST's AN5050 carefully.

---

## Day 24 🤖 — Sync indicator + cleanup

**Goal:** UI accurately reflects network state.

Tasks:
- [ ] Sync status icon: green (connected, queue empty), amber (connected
      but draining queue), red (disconnected >60s)
- [ ] Connection state events from `mqtt_task` → event group → GUI redraws
      the icon
- [ ] Disable "Start Inspection" if no config has ever been received
      (first-boot guard)
- [ ] Test: unplug cable, watch icon go red within 60s; plug back, watch
      it go green within a few seconds

---

# Phase 5 — Resilience & Polish (Days 25–30)

## Day 25 🤖 — Offline queue

**Goal:** Defect logs survive a disconnected period and replay in order.

Tasks:
- [ ] `defect_queue.c`: circular buffer in QSPI, ~1000 entries of 64 bytes each
- [ ] On publish failure (or while DISCONNECTED): append to queue
- [ ] On reconnect: `queue_task` drains queue, publishing one at a time,
      waiting for QoS 1 puback before advancing the tail pointer
- [ ] Queue depth visible in sync icon hover state (or as a count badge)

**Claude Code prompt:**
> Implement `defect_queue.c/h` as a power-loss-safe circular buffer in
> QSPI flash. Use double-buffered head/tail pointers in their own sector
> with sequence numbers; pick the higher sequence on boot. Each entry is
> a fixed 64-byte record. Provide `queue_push`, `queue_peek`, `queue_pop`,
> `queue_depth`. Add a host-side test harness simulating writes, power
> losses (interrupt mid-write), and recovery.

Risks: Power-loss safety is the hard part. Without double buffering you
can lose the queue on a crash mid-update.

---

## Day 26 🤖 — Watchdog + recovery

**Goal:** System self-recovers from hangs and unexpected states.

Tasks:
- [ ] IWDG enable at 8s timeout, kick from a low-priority watchdog task
      that itself waits on a queue from every other task
- [ ] If any task fails to check in within 6s, watchdog stops kicking → reset
- [ ] On reset, log a "recovered from watchdog reset" entry (read RCC reset
      flags before clearing)
- [ ] Server side: systemd `Restart=always` on FastAPI, MQTT bridge, Caddy

---

## Day 27 🤖 — Server hardening

**Goal:** Server tolerates restarts, power cuts, growing data.

Tasks:
- [ ] SQLite WAL mode in `db.py` engine config
- [ ] `scripts/backup-db.sh` doing `.backup` to dated file in `/var/backups/qc/`,
      keep last 14 days
- [ ] Add cron entry for daily backup
- [ ] Log rotation via journald + size limits
- [ ] Verify Mosquitto persistence file survives restart (retained messages
      still delivered to new subscriber)
- [ ] Add `/api/health/detailed` reporting DB OK, MQTT broker OK,
      last-seen of each device, current config version

---

## Day 28 🤖🔧 — Security pass

**Goal:** PoC-appropriate security baseline.

Tasks:
- [ ] Each STM32 has its own MQTT credentials in QSPI (not hard-coded);
      provisioning script writes them at flash time
- [ ] Mosquitto ACL: each device username restricted to its own topics
- [ ] Caddy in front of FastAPI with self-signed cert; document trust setup
      on dashboard machines
- [ ] Operator PINs hashed with argon2 (or sha256 fallback) — never logged
- [ ] Audit code for any `print()` of secrets
- [ ] `.env.example` finalized; real `.env` confirmed not in git

Risks: If argon2 is too slow on STM32 (it might be — it's memory-hard),
fall back to PBKDF2-SHA256 with high iteration count.

---

## Day 29 🔧 — End-to-end stress test

**Goal:** Confirm failure modes are clean.

Tasks:
- [ ] **Cable pull:** log 30 defects while disconnected → reconnect → all 30 arrive
- [ ] **Power cut on STM32 mid-log:** verify no corruption, in-flight log lost
      (acceptable) but queue intact
- [ ] **Power cut on RPi:** boot back up, retained config still delivered,
      DB intact
- [ ] **Config change while STM32 offline:** STM32 reconnects, immediately
      receives new config via retained message
- [ ] **Two STM32s** (if you have a second board, or use a software MQTT
      client mocking one): both stay in sync, defects from both logged
- [ ] **24-hour soak test:** leave the system running overnight, monitor
      memory leaks via heap stats, MQTT reconnect counts

Risks: This is where bugs hide. Allocate the full day for finding and fixing.

---

## Day 30 🤖🔧 — Documentation & demo prep

**Goal:** Project ready to show stakeholders.

Tasks:
- [ ] `README.md` — what the project does, screenshots, quickstart
- [ ] `docs/deployment.md` — how to flash STM32, how to deploy server
- [ ] `docs/operator-guide.md` — one-page printable for operators
- [ ] `docs/qc-guide.md` — how the QC responsable uses the dashboard
- [ ] Record a 3-minute screen+phone video of full workflow
- [ ] Tag the milestone: `v0.1.0-pilot-ready`

---

# Phase 6 — Field Pilot (Days 31–42)

## Day 31 🔧 — Plant deployment

Tasks:
- [ ] Mount STM32 in a temporary enclosure (cardboard or 3D-printed bracket
      is fine) at a real inspection station
- [ ] Run Ethernet to the nearest switch (coordinate with IT in advance)
- [ ] RPi in QC office, on UPS if possible
- [ ] Power both up, confirm operator can log in, full flow works in situ
- [ ] Print the operator quick-start sheet, tape it next to the station

---

## Day 32 🔧 — Shadow day 1

Tasks:
- [ ] Stand next to the operator for the first 2 hours of their shift
- [ ] Note every hesitation, every wrong tap, every "what does this mean?"
- [ ] Check dashboard in real time, confirm data is flowing
- [ ] After lunch: address the top 2 issues with hotfix flash + dashboard
      deploy if possible
- [ ] Brief end-of-day debrief with operator

---

## Day 33–35 🔧 — Iterate

Tasks:
- [ ] Address fixable issues from shadow day
- [ ] Check in with operator daily, briefly
- [ ] Watch dashboard data accumulate, sanity-check it against operator
      memory ("does this look like a normal day to you?")

---

## Day 36 🔧 — QC responsable training

Tasks:
- [ ] 60 min session with the QC responsable
- [ ] Show every dashboard page, every feature
- [ ] Have them add a new defect type, watch it appear on STM32
- [ ] Have them filter logs, export a CSV
- [ ] Hand off `docs/qc-guide.md`

---

## Day 37–40 🔧 — Hands-off observation

Tasks:
- [ ] No interventions unless something breaks
- [ ] Daily 5-min check of dashboard for data flow + device status
- [ ] Note any issues raised by operator or QC responsable

---

## Day 41 🔧 — Pattern analysis

**Goal:** Did the system surface patterns invisible on paper?

Tasks:
- [ ] Pull 7 days of data, generate a report
- [ ] Look for:
      - Defect rate spikes correlating with time of day
      - Specific defects clustering on specific product references
      - Operator-specific patterns (likely indicates training need, not
        operator fault — frame carefully)
- [ ] Sit with QC responsable, walk through findings together
- [ ] Compare to their paper-era intuition: confirm or surprise?

---

## Day 42 🔧 — Decision day

**Goal:** Documented go/no-go on next phase, with rationale.

Tasks:
- [ ] Structured interview with operator and QC responsable
      ("Would you go back to paper? What's missing? What's better?")
- [ ] Quantify if possible: defects logged per shift vs paper era
- [ ] Write `docs/pilot-results.md` with findings, recommendations, v2 backlog
- [ ] Present to management or stakeholders
- [ ] Three possible outcomes:
      1. **Scale:** plan to deploy at 5–10 more stations
      2. **Productionize:** invest in proper enclosures, redundancy,
         MES integration
      3. **Pivot:** if STM32 iteration speed was a blocker, evaluate
         RPi-Zero-based stations for v2

---

# Working with Claude Code — Daily Rituals

Adopt these habits from day 1:

**Start of session:** Open the repo, give Claude Code a one-line context:
"Working on Day 14, login screen. Yesterday I finished Day 13 (screen
skeletons). Reference firmware/CLAUDE.md."

**Before generating code:** Make sure the relevant `CLAUDE.md` and the
relevant `docs/*.md` file are up to date. Outdated context produces
plausible-looking but wrong code.

**After generating code:** Always read it before running. Especially on
firmware — silent bugs there cost hours to debug.

**End of session:** Ask Claude Code to summarize what changed, what's
half-finished, and what's next. Paste that summary into a `TODO.md` so
tomorrow's session starts with context.

**Weekly:** Ask Claude Code to review the week's commits against the
roadmap and `docs/decisions.md`. Catch architectural drift early.

---

# Scope-Cut Options if Behind Schedule

In rough priority order — drop the bottom first:

1. Stats heatmap → keep top defects + daily count only
2. CSV export → defer to v2
3. Settings page → defer (use seed script for user creation)
4. Watchdog task → defer (rely on systemd + manual restart)
5. argon2 PIN hash → use sha256+salt for PoC (faster on STM32)
6. Power-loss-safe queue → use simple non-atomic queue (data loss on power
   cut is OK for PoC)
7. Two-device test → defer (one device proves the architecture)
8. argon2 for dashboard passwords → use bcrypt

Never cut:
- The Phase 3.17 usability test
- The Phase 6.32 shadow day
- The Phase 6.41 pattern analysis

These are the demonstrations of value. Without them the PoC doesn't prove
anything.