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
