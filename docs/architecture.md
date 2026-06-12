# Architecture

How the Painting QC system is put together as of v1.0.0, and where to extend
it. This is the engineering companion to [decisions.md](decisions.md) (the
*why* behind each choice) and [api-spec.md](api-spec.md) / [data-model.md](data-model.md)
(the exact contracts). Read [principles.md](principles.md) first if you want the
ground rules every part here obeys.

---

## 1. System context

One server, three kinds of client, one plant LAN.

```
                         plant Wi-Fi / LAN
   ┌──────────────┐                          ┌─────────────────────┐
   │ Station tablet│  HTTPS  POST /inspections│                     │
   │ inspection PWA│ ───────────────────────▶ │                     │
   └──────────────┘  (offline queue drains)   │   Raspberry Pi 4B   │
                                              │  ┌───────────────┐  │
   ┌──────────────┐  HTTPS  REST + SSE        │  │  FastAPI       │  │
   │ QC responsable│ ───────────────────────▶ │  │  + SQLite (WAL)│  │
   │  dashboard    │ ◀───────────────────────  │  │  + Mosquitto   │  │
   └──────────────┘  live updates             │  │  + Caddy (TLS) │  │
                                              │  │  + dnsmasq     │  │
   ┌──────────────┐  HTTP   GET /kpi          │  └───────────────┘  │
   │ STM32 andon   │ ───────────────────────▶ │   (Docker Compose)  │
   │ board (wall)  │  (or MQTT subscribe)      │                     │
   └──────────────┘                           └─────────────────────┘
```

The **web surface (dashboard + inspection PWA) is the product's primary client
and selling point** (ADR-017). The STM32 is a **display-only KPI board**. The
server is the single source of truth; every client speaks a documented
contract, never a private one.

---

## 2. Components & responsibilities

| Component | One-sentence responsibility | Lives in |
|---|---|---|
| **server** | Persist inspections, serve config/analytics/KPIs, own all business rules | `server/` |
| **dashboard** | Admin config + analytics, and the kiosk inspection PWA | `dashboard/` |
| **firmware** | Show live room KPIs on a wall; no input | `C:\TouchGFXProjects\qc_node` (andon), `firmware/` |
| **infra** | Broker, friendly DNS, TLS, container orchestration, deploy | `infra/`, `scripts/` |

Each is independently buildable and deployable. The only hard runtime
dependency is *client → server over the LAN*; clients degrade gracefully when
the server is unreachable (PWA queues offline, board shows last value).

---

## 3. Server internals

FastAPI app, strict downward dependency direction (enforced by convention, see
`server/CLAUDE.md`):

```
routers ─▶ services ─▶ models ─▶ db
              ├─▶ mqtt.publisher ─▶ mqtt.bridge
              ├─▶ security  (JWT, argon2 — pure)
              └─▶ feature_flags  (DB-backed, cached)
```

- **routers/** are thin: validate a Pydantic schema, call one service, return.
  No SQL or business logic. One router per resource (`inspections`, `products`,
  `defect_types`, `operators`, `devices`, `kpi`, `reports`, `stats`, `events`,
  `feature_flags`, `constants`, `auth`, `health`).
- **services/** own transactions and side effects. This is where rules live
  (the 12-defects-per-category cap, soft-delete, "Other" fallback handling,
  operator attribution, KPI aggregation).
- **models/** are SQLAlchemy aggregates; **schemas/** are Pydantic, split
  `Create` / `Update` / `Read` per direction.
- **mqtt/** is a self-contained bridge (paho-mqtt). Retained but off the
  inspection critical path — see §6.

Cross-cutting concerns (config, logging, time, feature flags) are injected or
imported from one place (`app/config.py`, `app/logging.py`), never re-read from
the environment ad hoc.

### The inspection service — the load-bearing contract

`services/inspections.record_part(...)` is the **single** place a part
inspection becomes rows. Both transports call it:

```
POST /inspections (PWA, REST)  ─┐
                                 ├─▶ services.inspections.record_part() ─▶ inspection_logs
qc/device/{id}/inspection (MQTT)─┘        (one part → N defect rows or 1 OK row,
                                           shared part_inspection_id, category_kind)
```

This is the rule from `CLAUDE.md`: **never branch inspection logic per
transport.** A part is the schema-4 payload (PMP defect ids, INJECTION defect
ids, optional note, optional client `logged_at`). The service self-registers
the device, honours a client `logged_at` when present (so offline-queued parts
keep their original time), attaches the note only to "Autre" fallback rows, and
returns a `part_inspection_id`. Any new client type that can POST schema-4 is a
first-class inspection client for free.

---

## 4. Dashboard internals

React + Vite + TypeScript, feature-sliced. **Two entry bundles from one
codebase:**

| Bundle | Entry | Audience | Layout |
|---|---|---|---|
| Admin | `index.html` | QC responsable | full dashboard chrome |
| Inspection PWA | `inspect.html` | Inspectors | kiosk, big targets, no chrome |

- **features/** slices own their UI + data hooks: `inspect` (the PWA flow),
  `analytics`, `home`, `products`, `product-detail`, `defect-types`,
  `operators`, `devices`, `logs`, `live-products`, `live-stations`, `reports`,
  `settings`.
- **Data layer:** TanStack Query over a thin axios client; Zod-validated forms.
  Live updates come from **SSE** (`useServerEvents` → `GET /events`) which
  invalidates query caches on each new inspection; a 60s poll is the floor.
- **PWA offline:** `public/inspect-sw.js` (service worker, installable,
  fullscreen) + an **IndexedDB queue**. A failed `POST /inspections` is
  persisted and drained in order on reconnect; an online/pending indicator is
  always visible. Cap: 1000 queued parts (~24h).
- **Cross-cutting UI:** a notification layer (toasts + a notification center)
  driven by client-side **threshold evaluation** (`hooks/useAppAlerts` +
  `lib/thresholds`) over the KPI it already streams, plus connection state. PWA
  station tablets idle-logout after 5 min and offer remembered-user re-login.

Admin and inspection stay strictly separated (route trees, layouts, bundles) so
the kiosk surface is small and locked down.

---

## 5. Firmware (andon board)

A repurposed STM32H7B3I-DK on the wall, **display-only** (ADR-017/020):

- Wi-Fi via an external **ESP-01 (ESP8266)** over UART/AT — the module owns the
  IP stack; **no LwIP** (ADR-015). The transport is pluggable behind a HAL, so
  swapping to wired Ethernet is a contained change.
- Default data path: **HTTP `GET /kpi`** every N seconds → render big numbers
  (Taux NC, parts inspected) via TouchGFX. Option: subscribe to a retained
  `qc/display/kpi` over vendored coreMQTT.
- TouchGFX MVP discipline: Views render, Presenters decide, Models hold state —
  no business logic in Views. No dynamic allocation in steady-state paths.
- Config (Wi-Fi PSK, server host) lives in Octo-SPI flashed at provisioning,
  never in source.

---

## 6. Data & control flows

**Inspection (the hot path).** PWA builds a schema-4 part → `POST /inspections`
over HTTPS → `record_part` expands to `inspection_logs` → SSE notifies the
dashboard → andon board reflects it on its next `/kpi` poll. Offline, the part
sits in IndexedDB and drains later carrying its original `logged_at`.

**Config (server → clients, pull-based).** The responsable edits products /
defect types / operators in the dashboard → SQLite. The PWA picks up changes on
its **next fetch** — no device push needed (ADR-013/016/017). Mosquitto can
*also* mirror config on retained `qc/config/*` topics for future device add-ons,
but that is not required for the web client.

**KPIs.** `services/kpi` + `kpi_board` aggregate `inspection_logs`. `GET /kpi`
is operator-scoped when the caller is an `operator` (their own parts);
`GET /kpi/board` (role `station`) feeds the wall display.

**MQTT today.** Retained but lightly used. It is the *legacy* device transport
(still routed through the one inspection service) and an optional KPI/config
mirror — never the primary inspection path. See [mqtt-topics.md](mqtt-topics.md).

---

## 7. Identity, roles & attribution

Three roles on the `users` table; JWT bearer auth, argon2 hashing.

| Role | Can | Used by |
|---|---|---|
| `admin` | everything (config, analytics, operators) | QC responsable |
| `operator` | POST own inspections, read own KPI, read config | inspectors (PWA) |
| `station` | POST inspections w/ explicit `operator_id`, read config + KPI | andon board, tooling |

**Operators are login accounts** (ADR-018): an `operators` row links 1:1 to a
`users` row (`operators.user_id`); matricule = username. Attribution stays in
`operators`, so `inspection_logs` is untouched. For an `operator` caller the
server attributes the part to *their own* operator — body `operator_id` cannot
spoof. Credentials are minted once on `POST /operators` and rotated via
`regenerate-password` (reveal-once); only hashes are stored. The old
station+PIN flow is retired.

---

## 8. Deployment & runtime topology

Everything server-side is a container; local dev and prod are the *same* compose
stack with different env (see [deployment.md](deployment.md)).

```
infra/docker-compose.dev.yml  →  qc-server (FastAPI :8000)
                                  qc-dashboard (Caddy-served SPA :8080/:443)
                                  mosquitto (:1883)
                                  dnsmasq (host net, RPi only)
```

- **Access layer:** tablets reach `https://inspection.pmp` — `dnsmasq` resolves
  the name to the Pi's *current* DHCP IP (`interface-name`, no hardcoded
  address); Caddy issues an internal-CA cert so the PWA installs and runs
  offline. The andon board uses the Pi's IP directly (no DNS dependency).
- **Migrations** run on server container start (`alembic upgrade head`), so a
  `git pull` + restart applies schema changes without a rebuild.
- **State** is named volumes only: `qc-data` (SQLite), `mosquitto-data`,
  `caddy-data` (stable CA root).

---

## 9. Extension & integration seams

Where to add capability *without* touching the core. Each is a config or
additive change, not a rewrite — the point of the contracts above.

### New inspection client (scanner, handheld, second tablet vendor)
Speak schema-4 `POST /inspections` with a `station` token (or an operator
login). No server change. The PWA, the legacy device, and any future client all
funnel through `record_part`.

### MES / ERP integration
Read side: expose the existing analytics (`/reports/*`, `/kpi`, `/stats/*`) or
add a read-only export endpoint; the data is already aggregated in `services`.
Push side: add an outbound publisher (webhook or MQTT topic) fired *after*
`record_part` commits — the same after-commit side-effect pattern the MQTT
publisher already uses. Gate it behind a feature flag.

### Photo / attachment capture on a defect
Additive: an `attachments` table FK'd to `part_inspection_id`, a
`POST /inspections/{part_id}/attachments` route, and an upload widget in the PWA
defect flow (mirror the cheatsheet upload that already streams binaries through
Caddy). Behind a flag; offline queue stores the blob alongside the queued part.

### Multi-plant / multi-tenant
The seam is a `plant_id` scoping column on the top-level aggregates plus a claim
in the JWT. Today plant identity is a single deployment's env (`PLANT_NAME`) and
categories are plant-wide constants — deliberately not generalised yet (YAGNI),
but the service layer is the one place that would add the `WHERE plant_id = ?`
filter. Record it as an ADR when it lands.

### Auth / SSO
Auth is isolated in `routers/auth.py` + `security.py`. Swapping JWT-from-login
for OIDC/SSO means adding a token-exchange route and trusting an external
issuer's claims; roles and the rest of the app are unaffected because everything
downstream only reads `current_user.role`.

### Richer KPI transport for the board
Already pluggable: HTTP poll today, retained MQTT subscribe by config flag. A
push channel (WebSocket/SSE to the board) would reuse the `/events` machinery.

### Dashboard analytics
New charts/pages are new `features/` slices over existing endpoints; reporting
is browser-print (no server-side PDF), so a new report is a print stylesheet +
a query, not a backend job.

---

## 10. Versioning & compatibility

- **API:** all endpoints are implicit v1. A breaking change lives at
  `/api/v2/...`, never an in-place mutation. Additive fields are non-breaking.
- **Payloads** (inspection, MQTT config/KPI) carry an explicit
  `schema_version`; server and firmware validate it and refuse unknown
  versions. Current part model is **schema 4** (ADR-016).
- **Components** are versioned semver independently (`qc-server`,
  `qc-dashboard`, firmware). v1.0.0 is the first joint release.
- **Database** evolves only through Alembic migrations; never hand-edit schema.
  Soft-delete only (`active` + `archived_at`) — rows are never hard-deleted
  (ADR-006).

---

## 11. Where to look next

| To understand… | Read |
|---|---|
| Why a choice was made | [decisions.md](decisions.md) (ADR-001 → 020) |
| Exact endpoint shapes | [api-spec.md](api-spec.md) |
| Tables & columns | [data-model.md](data-model.md) |
| Topic schemas | [mqtt-topics.md](mqtt-topics.md) |
| Deploy / network setup | [deployment.md](deployment.md) |
| Kiosk tablet setup | [runbook-kiosk.md](runbook-kiosk.md) |
| Toggleable behaviour | [feature-flags.md](feature-flags.md), [build-flags.md](build-flags.md) |
| Per-component rules | `server/` · `dashboard/` · `firmware/` · `infra/` `CLAUDE.md` |
