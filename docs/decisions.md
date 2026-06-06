# Architecture Decisions

Records of significant design decisions made during Phase 0.
A decision here is a constraint — do not reverse it without adding a
new ADR explaining why.

Format per entry: **Context** (why we needed to decide), **Decision**
(what we chose), **Consequences** (what this locks in or trades off).

---

## ADR-001 — STM32H7B3I-DK as the end device

**Status:** Accepted

**Context:** The PoC needs a touchscreen terminal with Wi-Fi. Several
STM32 Discovery kits were candidates.

**Decision:** Use the STM32H7B3I-DK (STM32H7B3LIH6Q). It has an on-board
4.3" capacitive touch LCD, an on-board Inventek ISM43340 Wi-Fi module,
2 MB internal flash (enough for all firmware + many TouchGFX assets without
the dual-flash linker gymnastics the H750B-DK requires), 16 MB SDRAM for
the TouchGFX framebuffer, and 64 MB Octo-SPI for the config store and
offline queue.

**Consequences:**
- All firmware documentation uses H7B3I-DK-specific pin names and memory
  addresses.
- The ISM43340 Wi-Fi module is the only supported network interface for
  the PoC (see ADR-004).
- Module firmware version sensitivity must be managed (see
  `docs/firmware-versions.md`).

---

## ADR-002 — MQTT only for device communication

**Status:** Accepted

**Context:** The STM32 needs to send defect logs to the server and
receive config updates. Options were raw HTTP (simple) or MQTT
(message broker).

**Decision:** MQTT via Mosquitto. The STM32 publishes logs and subscribes
to config topics. The server publishes retained config and subscribes to
device topics.

**Consequences:**
- No raw HTTP from the STM32. The network transport layer calls
  `net_socket_*`; above it, the MQTT task handles all protocol logic.
- The MQTT broker (Mosquitto) is a required service. It runs in its own
  Docker container alongside the FastAPI server.
- The retained-message pattern gives new devices their config immediately
  on connect without any server-side request (see ADR-003).

---

## ADR-003 — Retained messages for config distribution

**Status:** Accepted

**Context:** When a new or rebooted STM32 connects to the broker, it
needs its full defect config and operator list before it can be used.
The server might not be running (Mosquitto is independent of FastAPI).

**Decision:** `qc/config/defects` and `qc/config/operators` are retained
messages. Mosquitto holds the last published value and delivers it to
every new subscriber immediately. The firmware writes this to Octo-SPI;
on a subsequent cold boot before any network connection, it reads from
flash.

**Consequences:**
- The device is usable (with last-known config) even if the server is
  down at boot time.
- Every server-side change to defect types or operators must trigger a
  new retained-message publish. The service layer owns this side effect.
- Retained messages must be re-published after a Mosquitto wipe/restart
  if persistence files are lost. The `scripts/deploy.sh` script handles
  this.

---

## ADR-004 — Wi-Fi via ISM43340 (no wired Ethernet)

**Status:** Accepted

**Context:** The PoC needs the STM32 to reach the RPi. Options were
wired Ethernet (reliable, complex PCB/cabling) or the on-board Wi-Fi
module (simpler, operationally riskier on a plant floor).

**Decision:** Use the ISM43340 Wi-Fi module already on the H7B3I-DK
board. Accept the Wi-Fi reliability risk with mitigations: offline queue,
connection-status indicator, dedicated SSID, site survey before pilot.
The `net/` abstraction layer makes a future swap to a W5500 wired shield
a contained change (one file + build flag).

**Consequences:**
- Plant-floor Wi-Fi reliability must be verified before going live. See
  `CLAUDE.md` → Wi-Fi Operational Considerations.
- A Day 31 site survey is mandatory before pilot deployment.
- The offline queue (`APP_FEATURE_OFFLINE_QUEUE`) is non-negotiable; do
  not disable it.

---

## ADR-005 — No LwIP; ISM43340 owns the TCP/IP stack

**Status:** Accepted

**Context:** Alternatives were: (a) integrate LwIP and use the ISM43340
as a raw network interface driver, or (b) use the ISM43340's own
TCP/IP stack via its AT-command API.

**Decision:** Option (b). The ISM43340 module contains an STM32F405 with
its own TCP/IP stack. The H7B3 host firmware calls the module's socket
API (`open`, `connect`, `send`, `recv`, `close`) via SPI. We do not run
LwIP — it would duplicate the stack and add cache-coherency risk.

**Consequences:**
- LwIP must never be added to the firmware. If you find a suggestion to
  use LwIP, it violates this ADR.
- The `net.h` abstraction hides whether packets go through ISM43340 or
  (in the future) a W5500 chip or POSIX sockets (host tests).
- The ISM43340 module firmware version matters. Verify and document it
  in `docs/firmware-versions.md` before Phase 4.

---

## ADR-006 — Soft deletes only; no hard deletes

**Status:** Accepted

**Context:** Operators, defect types, and categories will be renamed or
retired over time. Past defect logs must remain consistent with the
historical records that created them.

**Decision:** Never `DELETE` a row from the database. Set `active = 0`
and `archived_at = <UTC timestamp>` instead. Foreign keys in
`defect_logs` always resolve because the referenced rows still exist.

**Consequences:**
- Queries for "active" data must filter by `active = 1`.
- SQLAlchemy models include `active` and `archived_at` columns.
- The dashboard must distinguish active vs archived in any list that
  the QC responsable manages.
- The exception: `defect_logs` itself is append-only and never modified
  or deleted.

---

## ADR-007 — Docker for all server-side services

**Status:** Accepted

**Context:** The PoC runs on a Raspberry Pi 4 in a plant. Installing
Python, Node, Mosquitto, and Caddy natively creates a fragile, hard-to-
reproduce environment.

**Decision:** Every server-side service runs in a Docker container.
Local dev and production use the same Compose files with different `.env`
files. Multi-arch builds (`linux/amd64` + `linux/arm64`) ensure the
same images work on a dev laptop and the RPi.

**Consequences:**
- No native service installation on the RPi. `docker` and `git` are the
  only host dependencies.
- The RPi needs Docker installed and the user in the `docker` group.
- Image build must succeed with `--platform linux/arm64`.
- LXC is documented as an alternative but Docker is the default.

---

## ADR-008 — coreMQTT as the firmware MQTT client

**Status:** Accepted

**Context:** Firmware needs an MQTT client. Options: coreMQTT (AWS,
MIT license, no dynamic allocation), Paho embedded (heavier), or a
custom implementation.

**Decision:** coreMQTT, vendored under `Middlewares/coreMQTT`. It is
transport-agnostic — we provide function pointers for `send` and `recv`
that map to `net_socket_*`. It makes no dynamic allocations; buffers
are caller-supplied. This satisfies the "no dynamic allocation in steady
state" rule.

**Consequences:**
- The transport glue in `Application/mqtt/mqtt_transport.c` must handle
  partial sends and timeouts correctly. ~50 lines of careful code.
- coreMQTT's API requires a static buffer for the MQTT context struct.
  Size this for the largest expected payload (the defect config message).

---

## ADR-009 — TouchGFX as the display framework

**Status:** Accepted

**Context:** The STM32H7B3I-DK has an on-board LCD with an RGB interface
driver. Options were TouchGFX (ST's official GUI framework, deeply
integrated with CubeMX) or LVGL (open-source, portable).

**Decision:** TouchGFX 4.x. It is the officially supported framework for
the H7B3I-DK board, ships with Designer tooling, and generates the HAL
integration automatically via CubeMX. The SDRAM framebuffer is managed
by the TouchGFX HAL.

**Consequences:**
- Do not edit files under `TouchGFX/generated/`. Regenerate from Designer.
- Views must not contain business logic. Views render; Presenters decide;
  Models hold state. See `firmware/CLAUDE.md`.
- TouchGFX uses C++. The rest of the firmware is C11. Do not let C++
  spread outside the GUI layer.

---

## ADR-010 — Schema versioning in every MQTT payload

**Status:** Accepted

**Context:** The server and firmware are deployed independently. A
mismatch in payload format (e.g., a new field added) must be detectable
rather than silently producing corrupt data.

**Decision:** Every MQTT payload includes `"schema_version": <integer>`
as the first field. Both sender and receiver validate it. An unknown
version is logged and discarded. The firmware refuses to act on a command
or update its config from an unrecognised version. The server does the
same.

**Consequences:**
- Evolving a payload schema requires bumping `schema_version`.
- Rolling upgrades require the new code to support both the old and new
  version for one release cycle.
- The version is an integer per topic, not a global API version. Each
  topic evolves independently.
- See `docs/mqtt-topics.md` → Schema Versioning for the full rules.

---

## ADR-011 — Adopt ST Network Library as the es-wifi-to-net.h bridge

**Date:** 2026-05-15
**Status:** Accepted

**Context:** The firmware needs a portable socket API (`net.h`) that
the rest of the stack (coreMQTT, SNTP, defect queue) calls. The
underlying transport is the Inventek ISM43340 Wi-Fi module via SPI.
Two ways to bridge: (a) wrap the es-wifi BSP driver directly in our
own ~300-line shim; (b) use the ST Network Library that already
wraps the es-wifi BSP and present a thin ~50-line adapter on top of it.

**Decision:** Option (b). Vendor `STM32_Network_Library/` from STM32CubeH7
into `firmware/Middlewares/ST/STM32_Network_Library/`. Implement
`Application/net/net_wifi_ism43340.c` as a thin shim mapping our `net.h`
to the Library's socket API. The Library's es-wifi adapter and BSP
driver are also vendored under their respective paths.

**Consequences:**
- Saves approximately one day of firmware development (Day 18 scope reduced).
- Aligns with the architecture ST intended for this module.
- Adds a vendored middleware whose upstream is in light maintenance;
  any bug fixes are on us. Acceptable at PoC scale.
- `net.h` remains the portability boundary; future swap to a different
  transport (e.g., W5500 Ethernet shield) replaces only the shim file
  and the underlying middleware, not application code.
- Reconnect orchestration and FreeRTOS event signaling stay in our
  shim/`net_task` — the Library does not own them.
- `Application/net/net_wifi_ism43340.c` is the ONLY file allowed to
  import the Library's headers. Enforced as a code-review rule in
  `firmware/CLAUDE.md`.

**Alternatives considered:**
- Direct es-wifi BSP wrapping: more control, more code, more bugs to
  own. Rejected on cost/benefit.
- LwIP-on-host with the Wi-Fi module as a pure SPI link: not how the
  ISM43340 firmware works (the module owns its own IP stack).
  Architecturally impossible.

---

## ADR-012 — CI/CD via GitHub Actions + GHCR

**Date:** 2026-05-16
**Status:** Accepted

**Context:** Day 6 of the roadmap. The server has accumulated enough
CRUD, auth, and MQTT-handler code that local test discipline alone is
not sufficient — regressions slip between manual pytest runs. The RPi
4B can technically build Docker images but doing so is slow (~15 min
full stack) and competes with running services for RAM. Multi-arch
builds belong upstream.

**Decision:** Two GitHub Actions workflows:
- `ci.yml` — runs server pytest + ruff and dashboard vitest + tsc on
  every push and every PR to main. Target: <3 min wall time.
- `build-images.yml` — builds and pushes multi-arch (amd64 + arm64)
  Docker images to ghcr.io on push to `main` and on `v*` tags.

Firmware CI deferred to a later phase.

**Consequences:**
- The Raspberry Pi never builds images; it only pulls from GHCR.
- `scripts/deploy.sh` is the canonical deploy path; image build is
  decoupled from deploy.
- ARM64 builds use GitHub-hosted native ARM64 runners
  (`ubuntu-24.04-arm`), not QEMU emulation. Build time is ~4 min per
  arch, matching amd64. The per-arch jobs push by digest; a merge job
  assembles the final multi-arch manifest via `docker buildx imagetools
  create`.
- GHCR repo visibility matches the source repo (private). The RPi
  needs a one-time `docker login ghcr.io` with a Personal Access Token
  (`read:packages` scope).
- CI never receives production secrets. Tests use ephemeral values
  generated per run.

**Alternatives considered:**
- Docker Hub: adds another account and rate-limits anonymous pulls.
  Rejected.
- Self-hosted runner on the RPi: defeats the goal of offloading builds.
  Rejected.
- Single unified workflow: mixes fast test feedback with slow image
  builds; harder to triage. Rejected.

---

## ADR-013 — Product-scoped defect types with fixed plant-wide categories

**Date:** 2026-05-19
**Status:** Accepted

**Context:** The original model treated defect types as a flat plant-wide
list grouped into two free-form categories. Talking through the actual
plant workflow with the responsable revealed: (a) defects are
intrinsically product-specific — a paint defect on an engine hood
differs in nature and frequency from one on a cosmetic case, so
averaging across products hides signal; (b) the two categories are NOT
free-form — they map to a fixed business distinction: defects in PMP's
own paint work (`PMP`) vs. defects in upstream injection-moulded parts
(`INJECTION`). Making categories configurable added complexity with zero
business value.

**Decision:**
1. Add `Product` entity. Defect types carry a `product_id` FK.
2. The two categories become a plant-wide enum (`PMP`, `INJECTION`)
   with fixed display names (`"PMP Défauts"`, `"Injection Défauts"`),
   defined in `server/app/constants.py`. Not a DB table.
3. Each `(product_id, category_kind)` pair has its own cap of 12
   user-defined defect types.
4. Each `(product_id, category_kind)` has exactly one auto-created
   `is_other_fallback=true` defect type, label fixed at
   `"Autre — préciser"`, not counted toward the cap, undeletable
   from the UI.
5. Operators select a product at session start. Every defect log
   carries `product_id`. The old free-text `product_ref` field is
   removed.
6. Existing seed logs are truncated and regenerated.
7. MQTT config topic renamed `qc/config/products` (schema_version 2).
   A new `qc/device/{id}/session` topic records session start with
   `operator_id` + `product_id`.

**Consequences:**
- Cleaner separation of "our defects" vs "supplier defects" in
  analytics. Per-product trend charts become meaningful.
- STM32 firmware must include a product-selection screen between login
  and defect grid. TouchGFX flow: splash → login → product selection
  → defect grid → summary. One additional screen — minor cost.
- MQTT payload schemas bumped: `qc/config/products` (was
  `qc/config/defects`), `qc/device/{id}/defect` schema_version → 2.
- Devices use ephemeral session state (operator + product), not a
  persistent device→product mapping. Aligns with reality: a station
  inspects different products throughout the day.
- `server/app/constants.py` is the single source of truth for
  category display names. Dashboard fetches them from
  `GET /constants/categories`.

**Alternatives considered:**
- Free-form categories per product: rejected. PMP's business needs the
  PMP-vs-INJECTION distinction stable across products for cross-product
  trend analysis.
- Device-fixed product mapping: rejected. Real plants run multiple
  products through the same inspection station.
- Keep flat global defect types: rejected. Loses the per-product
  signal that is the core value of the system.

---

## ADR-014 — Inspection outcomes (DEFECT/OK) and paper-taxonomy seed

**Date:** 2026-05-19
**Status:** Accepted

**Context:** The PoC only logged defect taps. Comparing defect counts
across products or shifts without knowing the total inspections performed
makes the Taux NC (non-conformity rate) unmeasurable. Reviewing the
actual paper QC form (SVI-PRD-17) revealed that operators already tick
"OK" for passing parts and that the paper records 7 PMP defect types and
10 INJECTION defect types — a taxonomy that had not been captured in the
seed data.

**Decision:**

1. Rename `defect_logs` table → `inspection_logs`. Add an `outcome`
   column (`'DEFECT'` | `'OK'`, NOT NULL, default `'DEFECT'`).
2. Make `defect_type_id` nullable. A CHECK constraint enforces that it is
   non-null only when `outcome = 'DEFECT'`.
3. Replace MQTT topic `qc/device/{id}/defect` (schema_version 2) with
   `qc/device/{id}/inspection` (schema_version 3). The new payload carries
   `outcome` and optional `defect_type_id`. The old topic is retained as a
   registered handler that logs a warning and discards all messages — it is
   not silently ignored, so operators of old firmware see actionable log
   entries.
4. Add `GET /inspection-logs/reports/hourly?date=YYYY-MM-DD` returning
   a 24-row hourly Taux NC report per category (PMP and INJECTION).
   Keep `GET /logs` as a legacy alias so the existing dashboard does not
   break before Commit 2.
5. Seed the defect taxonomy from SVI-PRD-17:
   - PMP (7 types): Poussière, Griffure, Trace, Filament, Manque matière,
     Coulure matière, Pt brillant.
   - INJECTION (10 types): Givrage, Trace d'huile, Rayure, Brillance,
     Tache, Bavure, Flux, Effet de bord, Ventouse, Coup.
   Applied to every product in the dev seed. Existing seed is truncated
   on migration.
6. Alembic migration `0004_inspection_logs_with_outcome.py` creates the
   new table, migrates existing rows (all become `outcome='DEFECT'`), then
   drops the old `defect_logs` table.

**Consequences:**
- Taux NC (defects ÷ total inspections) can now be computed hourly.
- STM32 firmware must be updated to publish `qc/device/{id}/inspection`
  (schema_version 3) and add an "OK" button to the defect grid screen.
  Until firmware is updated, the old `defect` topic produces warning logs
  on the server but no data loss (logs are still complete for DEFECT taps
  sent on the old path — they're just discarded server-side, not stored).
- `defect_type_id` nullable requires the service and schema layers to
  handle `None` for OK rows (outer join in queries, `Optional` in Pydantic).
- CSV export header gains `outcome` column; downstream consumers must
  update.

**Alternatives considered:**
- Separate `ok_logs` table: rejected. One table for all inspection events
  simplifies queries and keeps the audit trail contiguous.
- Keep `defect_logs` name: rejected. The table now records OK events, so
  the name would be actively misleading.
- Require firmware upgrade before accepting data: rejected. Log-and-discard
  on the legacy topic is kinder to incremental deployments.

---

## ADR-015 — ESP-01 (ESP8266) over UART supersedes the ISM43340 transport

**Date:** 2026-06-01
**Status:** Accepted (supersedes the transport choice in ADR-004; partially
supersedes ADR-011)

**Context:** ADR-004 selected the on-board Inventek ISM43340 Wi-Fi module
(SPI2) and ADR-011 chose the ST Network Library + es-wifi BSP as the bridge to
a `net.h` socket abstraction. In practice that path proved slow to bring up:
SPI solder-bridge configuration, the scan-once firmware limitation, and the
weight of the Network Library + es-wifi vendoring. During firmware bring-up the
transport was switched to an external **ESP-01 (ESP8266)** module driven by
Hayes-style AT commands over **USART2** (115200 8N1, DMA receive-to-idle). This
change was made directly in code without an ADR; this record ratifies it.

**Decision:**
1. The device's network transport is the ESP-01 over UART, not the ISM43340
   over SPI. Driver: `netif/esp01_transport.c` — DMA RX ring buffer, `+IPD`
   payload de-framing, `AT+CWJAP` join, `AT+CIPSTART`/`AT+CIPSEND` TCP client,
   `CLOSED` URC detection. It implements the coreMQTT `TransportInterface_t`
   (`recv`/`send`/`writev`) directly.
2. MQTT uses **coreMQTT v5 (MQTT 5.0)** wrapped in a dedicated FreeRTOS agent
   task (`netif/mqtt_agent.c`): command queue, subscription registry,
   reconnect/back-off. This exceeds the plain-coreMQTT plan of ADR-008 (still
   coreMQTT, still MIT, still no dynamic allocation in steady state).
3. The planned `net.h` pluggable-backend abstraction (Wi-Fi / W5500 Ethernet /
   host) was **not** built. coreMQTT talks to the ESP-01 transport directly.

**Consequences:**
- ADR-005 still holds in spirit: the ESP-01 owns its own TCP/IP stack; the H7B3
  runs no LwIP and only uses a TCP client socket via AT commands.
- The ISM43340-specific guidance in `firmware/CLAUDE.md` and
  `docs/firmware-versions.md` (SPI2 pins, es-wifi BSP, Network Library,
  C3.5.2.6 module firmware) is **historical**, not current. It should be
  marked as superseded.
- Losing `net.h` means the "swap Wi-Fi for wired Ethernet is one file" promise
  (ADR-004 consequence) no longer holds; a future transport change now touches
  `esp01_transport.c` and the agent wiring. Acceptable at PoC scale; revisit if
  Ethernet becomes a requirement.
- ESP-01 has less RAM/flash and a smaller MTU than the ISM43340; large retained
  config payloads must be chunked/bounded (`CONFIG_JSON_MAX_SIZE` is 4 KB in
  `mqtt_config_callbacks.c`).
- Wi-Fi credentials + broker config still come from the Octo-SPI provisioning
  store (`config_store.c`); the hardcoded fallback in `main.c` must be removed
  before pilot (see `docs/post-poc-todo.md`).
- The firmware project lives at `C:\TouchGFXProjects\qc_node` (outside this
  repo). As of 2026-06-01 it is under git locally; it should be moved into / or
  mirrored under `firmware/` so the monorepo is the source of truth.

**Alternatives considered:**
- Persevere with ISM43340 + ST Network Library: rejected for PoC velocity; the
  SPI bring-up and module-firmware sensitivity were not paying for themselves.
- Keep the `net.h` abstraction around the ESP-01: deferred, not rejected — a
  thin `net.h` over the AT driver would restore portability cheaply and is a
  reasonable follow-up if a second transport is ever needed.

---

## ADR-016 — Per-part full inspection (supersedes ADR-014 per-tap events)

**Date:** 2026-06-02
**Status:** Accepted

**Context:** ADR-014 logged one `inspection_logs` row per UI tap (each defect, and
each "Pièce OK"). A category-level "Pièce OK" carried no defect, so it had no
category — and the hourly Taux NC report attributed every OK to BOTH PMP and
INJECTION. The natural unit of the workflow (and of Taux NC = NC parts ÷ parts)
is the **part**, which is inspected once for PMP and once for INJECTION.

**Decision:** The device publishes one message per part on the summary screen
(`qc/device/{id}/inspection`, `schema_version 4`):
`{device_id, operator_id, product_id, pmp_defect_type_ids:[…],
inj_defect_type_ids:[…], note}`. An empty list = the part passed (OK) for that
category. The server expands it into `inspection_logs` rows — one per selected
defect, or one OK row for an empty category — each stamped with an explicit
`category_kind` and a shared `part_inspection_id` (uuid). The hourly report
counts **distinct parts** per category (NC = parts with ≥1 defect in that
category). Migration `0005` adds `category_kind` + `part_inspection_id`.

**Consequences:**
- Category is explicit on every row (including OK); no more counting an OK in
  both categories.
- One publish per part instead of N — fewer sends over the flaky ESP-01 link,
  and the part result is atomic.
- The firmware accumulates PMP/INJ selections in the Model between screens and
  flushes once on the summary; the per-tap path (and the schema-3 single handler)
  is retired but the server still accepts schema 3 for backward compatibility.
- `defect_type_id`/`device_id` foreign keys still apply; the server self-registers
  the device. Top-defect Pareto still works (count DEFECT rows); the rate report
  counts parts.
- The INJ grid has 7 regular slots but the SVI-PRD-17 INJECTION taxonomy has 10
  types — the last 3 are not reachable on the grid yet (UI follow-up).

---

## ADR-017 — Web PWA inspection client; STM32 demoted to a KPI andon board

**Date:** 2026-06-04
**Status:** Accepted (supersedes the premise — established since Day 1 and in
ADR-013 — that the STM32 is the inspection terminal; complements ADR-015)

**Context:** The inspection terminal was an STM32H7B3I-DK running TouchGFX, with
the operator flow (login → product → defect grid → summary) on the device. In
practice every hard, recurring problem in this project lived *below* the
inspection UI, in the embedded client:

- ESP-01 AT-over-UART link is flaky and timing-sensitive (CIPSEND prompts,
  SEND OK timeouts, keep-alive, broker-auth/passwd drift) — see ADR-015.
- The Octo-SPI offline queue conflicts with TouchGFX DMA2D asset reads (an
  OSPI/rendering hazard with no clean fix on this hardware).
- TouchGFX has no dynamic text without a Designer round-trip; a Designer
  regen wiped a whole screen and renamed typed-text ids, and dynamic defect
  grids / dates / counts are painful (wildcards, fonts, custom containers).
- Per-board flashing, Wi-Fi creds in Octo-SPI, SNTP-over-AT, no real offline
  story — all bespoke and fragile.

None of these touch the server, data model, API, auth, or dashboard, which are
solid. The inspection client is just one consumer of a stable contract, and the
contract — not the device — is the asset.

**Decision:** Move the inspection UI to a **web PWA hosted inside the existing
dashboard**, run on **wall/stand-mounted tablets** (one per station, kiosk-
locked), and **demote the STM32 to a passive KPI "andon" board** that displays
big-number metrics (Taux NC, parts inspected, NC count) for the room.

1. **Inspection client = PWA** (`dashboard/`, a touch-optimised `inspect/`
   route + layout): login → product → PMP grid → INJ grid → summary → submit.
   Defect grids are dynamic from `GET /products/{id}/defect-types`. Offline via
   service worker + IndexedDB, drained on reconnect.
2. **Logging via REST.** The PWA `POST`s the schema-4 part inspection to a new
   `POST /inspections`. The per-part expansion logic is refactored into a shared
   `services/inspections` module that both the REST endpoint and the existing
   MQTT handler call — one code path, two transports.
3. **Inspectors = the existing `operators` + PIN.** The tablet holds one
   low-privilege "station" account (JWT); the inspector picks their name and
   enters their PIN, verified server-side (`POST /operators/verify-pin`).
   `operator_id` lands on the inspection — identical audit trail, no data-model
   change. The ADR-013/016 model (product-scoped defects, per-part schema 4)
   is reused verbatim.
4. **STM32 = andon KPI board.** Firmware strips to: Wi-Fi connect → fetch KPIs
   → render big numbers via TouchGFX. **Default transport: HTTP polling** of a
   new `GET /kpi` every few seconds (simplest; no broker dependency). MQTT
   (subscribe to a retained `qc/display/kpi`) is an option if HTTP-over-AT is
   awkward. Deleted: login, product/defect grids, commit flow, offline queue,
   SNTP. ~80% less firmware.
5. **Mosquitto is retained** but lightly used (future device add-ons, optional
   KPI push). It is no longer on the inspection critical path.

**Consequences:**
- Upholds the project's core principles better, not worse:
  - *Reusability through clear contracts:* the REST/MQTT inspection schema is
    the stable interface; clients (web, embedded, future) are swappable.
  - *Portability:* a browser PWA runs on any tablet/phone with no per-device
    build; the andon board's transport is a config choice (HTTP or MQTT).
  - *Modularity:* one `inspections` service, called by REST and MQTT; the PWA
    is a self-contained dashboard feature slice; the board is display-only.
- Serves the three PoC goals better: a tablet UI is faster than the 4.3" device
  (goal 1); config changes appear instantly via live API fetch, no MQTT push
  (goal 2); the dashboard/andon add ambient pattern visibility (goal 3).
- Retires the riskiest subsystems (ESP-01 input path, OSPI queue, TouchGFX
  dynamic-UI). The embedded investment is *repurposed*, not discarded — the
  Wi-Fi + TouchGFX rendering live on in the andon board.
- New surface area: tablet fleet needs kiosk mode + light MDM + powered mounts;
  the PWA needs a service worker + IndexedDB offline queue; one new low-priv
  `station` role and a `verify-pin` endpoint.
- Migration is **reversible and parallel:** the STM32 terminal and the PWA can
  both log to the same API/data during the pilot; cut over only when proven.

**Alternatives considered:**
- *Keep pushing the STM32 inspection terminal:* rejected — the OSPI/TouchGFX
  hazard and ESP-01 flakiness have no clean fix on this hardware, and dynamic
  config-driven UI fights the toolchain.
- *Per-inspector web logins (drop operators/PIN):* deferred — reusing
  operators + PIN preserves the audit model and the familiar select-name→PIN
  UX with near-zero change.
- *Retire Mosquitto entirely (HTTP everywhere):* deferred, not rejected — kept
  for future device add-ons; the inspection path no longer needs it.
- *BYOD phones / shared handhelds:* rejected for the pilot in favour of fixed,
  kiosk-locked station tablets (ruggedness, always-on, hygiene, control).

---

## ADR-018 — Operators are login accounts (username + password); retire the station+PIN flow

**Date:** 2026-06-04
**Status:** Accepted (supersedes ADR-017 §3 and accepts the "per-inspector web
logins" alternative ADR-017 deferred)

**Context:** ADR-017 shipped a two-step inspector sign-in: the tablet held one
shared low-privilege `station` JWT, and each operator then entered a name + PIN
(`POST /operators/verify-pin`). On the device this tested poorly: a "log in to
the account, *then* enter a PIN" sequence read as two logins and confused users,
and the PIN's purpose wasn't obvious. The product owner asked for a single,
conventional **username + password per operator**, with one login page that
redirects by role.

**Decision:** Make operators **login users** (role `operator`) and drop the PIN
from the inspection path.

1. **One auth source.** Keep the `operators` table for attribution (so
   `inspection_logs.operator_id` and every stats/query path are untouched) and
   add a nullable `operators.user_id → users.id` link (migration 0006). An
   operator is a `users` row with role `operator`, 1:1 with an `operators` row.
2. **Credentials minted on create.** `POST /operators {name}` creates the
   operator *and* its login user, generating a unique **username** (slug of the
   name) and a **password**, returned in plaintext **once**
   (`OperatorWithCredentials`); only the hash is stored. `POST
   /operators/{id}/regenerate-password` rotates it (reveal once) and back-fills
   a login for legacy operators. This reuses the reveal-once pattern that
   ADR-017's auto-PIN introduced — PIN → password.
3. **Self-attribution.** `/auth/me` returns `operator_id` for role `operator`.
   `POST /inspections` accepts role `operator` and attributes the part to *their
   own* linked operator — the request body cannot spoof `operator_id`.
   Admin/station callers still pass `operator_id` explicitly.
4. **Unified login + redirect.** One dashboard login page; `admin` → admin
   dashboard, `operator` → inspection PWA. The PWA no longer has its own station
   login or name-grid/PIN-pad; it enters from the shared login token and reads
   `operator_id` from `/auth/me`.
5. **PIN retired.** `verify-pin`, `set-pin` and the operator PIN generation are
   removed from the web contract. `operators.pin_hash` stays nullable for the
   historical MQTT operators config only; the `station` role is kept for the
   andon board / tooling.

**Amendment (2026-06-06) — username = matricule, plus HR details.** Point 2's
auto-generated name-slug username was replaced: the responsable now enters the
operator's **matricule** (employee id) on create, and that matricule **is** the
login username (`users.email`). The password is still server-minted and
revealed once. Matricules are unique among operators (duplicate → HTTP 409) and
must match `^[A-Za-z0-9._-]+$`. The same form captures optional HR details —
`last_name`, `phone`, `address`. New columns: `operators.matricule` (unique),
`last_name`, `phone`, `address` (migration 0009). Rationale: a plant already
issues every operator a matricule; reusing it as the login is more memorable and
auditable than a generated slug, and removes name-collision suffixes.

**Consequences:**
- Simpler, conventional UX: one sign-in, one login page, role-based routing.
- Cost: on a *shared* wall tablet, per-operator credential entry is slower per
  hand-off than a name-tap + PIN. Accepted by the product owner; revisit with a
  fast-switch affordance if shift hand-offs prove painful.
- Data model change is additive and low-risk (one nullable FK column); no
  inspection-log migration. Legacy operators are login-less until a password is
  regenerated for them.
- The reveal-once credential machinery and `station` role from ADR-017 are
  reused, not discarded.

**Alternatives considered:**
- *Keep station+PIN, just hide the station step (single visible PIN):* would
  preserve fast switching, but the owner explicitly wanted username+password.
- *Merge operators into `users` (drop the operators table):* rejected — would
  force a risky FK/data migration on `inspection_logs` for no functional gain.
- *Hybrid one-field login (admin email+pwd OR operator id+PIN):* rejected as
  more login logic for the same outcome.

---

## ADR-019 — Product & operator as first-class analytics dimensions; operator score = productivity

**Date:** 2026-06-06
**Status:** Accepted

**Context:** Operators inspect different products simultaneously, so a
device-centric live view (ADR-016 "Stations en direct") and a single global
quality report don't answer "how is *this product* doing right now?" or "who is
my most productive operator?". The product owner asked to emphasize per-product
analytics, richer product/operator metadata, and a small operator scoreboard.

**Decision:**

1. **Product gains a fiche.** `products` adds `reference`, `client`,
   `cheatsheet` (free text) — migration 0008. Shown on the product page; the
   product list filters by `client` and suggests previously-used clients.
2. **Operator gains HR details** (`last_name`, `phone`, `address`) alongside the
   `matricule` login — migration 0009 (see ADR-018 amendment).
3. **Live-products view.** `GET /products/live` pivots today's `inspection_logs`
   on the product (mirroring `GET /devices/live`): per active product it returns
   the operators currently working it, part/NC/OK counts, the day's Taux NC, and
   a shared recent-defect feed. Backs a new "Produits en direct" dashboard page.
4. **Reports gain a per-product section and an operator leaderboard.**
   `GET /reports/quality` adds `by_product` rows (parts, NC, Taux NC, PMP/INJ
   split) and enriches `by_operator` with `matricule` + a 1-based `rank`.
5. **Operator score = productivity (parts inspected).** The leaderboard ranks
   operators by the number of parts inspected, not by quality, and highlights
   the top operator.

**Consequences:**
- All additive schema (three product + four operator nullable columns); no
  change to `inspection_logs`, so every existing stats/attribution path is
  untouched. Live-products and the report sections are pure read aggregations
  over the same per-part data the dashboard already uses.
- "Productivity" rewards throughput; it can be gamed by inspecting fast/loose.
  Accepted for the PoC as a motivator; a blended quality+throughput score is a
  later refinement behind the same endpoint.

**Alternatives considered:**
- *Score by quality (low Taux NC):* rejected for now — penalizes operators on
  intrinsically harder products and discourages honest defect logging, the
  opposite of what the tool should reward during the pilot.
- *Reuse `GET /devices/live` and group client-side:* rejected — the part→product
  pivot and operator roll-up belong in one server aggregation, not duplicated in
  the dashboard.

---

## ADR-020 — Andon KPI board: one screen, auto-rotating body, on-device severity, bounded board payload

**Date:** 2026-06-06
**Status:** Accepted

**Context:** The repurposed STM32H7B3I-DK (480×272, TouchGFX, display-only,
ESP-01 over AT) must show, at a glance from across the room: the live products
under inspection, Taux NC, and the trending defects with each one's ratio —
with green/orange/red severity on both products and defects. It is unattended
(no input, no human login) and constrained (ESP-01 JSON limits, no steady-state
heap). `GET /kpi` today returns global numbers only. Full UI spec:
`firmware/UI-SPEC.md`.

**Decision:**

1. **One Screen, persistent header + auto-rotating body.** The header (global
   Taux NC, connection, clock) is always visible; the body **auto-cycles**
   every ~8 s between a *Products* panel (≤4 tiles) and a *Defects* panel (≤4
   ratio bars). No navigation, no input — it's a wall board.
2. **Four-state severity, computed on-device.** `Severity { UNKNOWN, GOOD,
   MODERATE, CRITICAL }` → grey / green / orange / red. The board payload is
   **threshold-agnostic** (raw rates); the firmware maps rate→severity using
   thresholds in its Octo-SPI config (flag hierarchy — not hardcoded, not
   server-side). Defaults: **product/global NC rate** GOOD ≤ 5 %, MODERATE ≤
   10 %, CRITICAL > 10 %; **defect share** (count/total) GOOD < 20 %, MODERATE
   < 35 %, CRITICAL ≥ 35 %. `UNKNOWN` (grey) is the boot/stale value so the
   board never shows green before it has data.
3. **Auto-auth, no login.** The board holds a provisioned **`station`**
   credential (long-lived token or user/pass) in Octo-SPI, joins Wi-Fi, logs in
   once at boot, caches the JWT, and re-auths on 401. Reuses the `station` role
   kept by ADR-018. `provision-device.sh` mints it.
4. **Boot/placeholder state.** A loading overlay covers the screen until the
   first `200`; values start `—`, severity `UNKNOWN`, connection `OFFLINE`. A
   small screen state machine (BOOT → CONNECTING → LIVE → STALE → OFFLINE)
   drives visibility; `updated_at` age drives STALE/OFFLINE.
5. **Bounded board payload.** New `GET /kpi/board` returns one fixed-shape
   snapshot — global block + `products` (≤4, pre-sorted) + `defects` (≤4, by
   count, each with `ratio`) — so the firmware parses into fixed buffers with no
   allocation. Same payload is the body of the retained `qc/display/kpi` MQTT
   message (optional transport). Caps (4/4) match the screen and the firmware
   arrays.
6. **Animations are signal, not decoration.** Idle is static; motion marks
   change — KPI number roll, bar-width tween, fade-in on first data, and a short
   pulse when a tile/bar turns CRITICAL. Cheap (DMA2D box/text fades); no
   TextureMapper/Canvas in steady state.

**Consequences:**
- `GET /kpi/board` is a pure read aggregation reusing `compute_kpi` +
  `compute_live_products` + a today-top-defects query; no schema change.
- Thresholds live on the device, so tuning the board doesn't touch the server.
- Auto-rotation adds a small timer state machine in firmware but keeps text
  large and the design to one Screen — the "minimal, 1 page" ask.

**Alternatives considered:**
- *Static dense single screen (no rotation):* rejected — fitting products +
  defects + global at once on 480×272 forces text too small for a wall board.
- *Server computes severity / sends colors:* rejected — thresholds belong in the
  device's config layer (flag hierarchy); keeps the payload reusable and the
  board independently tunable.
- *Board calls `GET /kpi` + `GET /products/live` separately:* rejected — two
  unbounded round-trips and JSON too large for the ESP-01; one bounded payload
  is the contract.
