# Painting QC — Roadmap (web-PWA pivot, fast prototyping)

> Supersedes the original 42-day embedded build plan. As of ADR-017 the
> inspection client is a **web PWA on station tablets** and the STM32 is a
> **KPI andon board**. The server, data model, API, auth and dashboard already
> exist and are reused as-is — so this is a fast vertical-slice effort, not a
> rebuild.

## Operating principles (hold these on every task)

- **Reusability through clear contracts.** The inspection schema (schema-4
  part inspection) is the stable interface. The PWA, the andon board, and any
  future client speak it. Never branch logic per-client in the server.
- **Portability.** The PWA runs on any tablet/phone, no per-device build. The
  andon board's transport (HTTP poll vs MQTT subscribe) is a config flag, not a
  rewrite. The server runs unchanged on a laptop, CI, or the RPi (Docker).
- **Modularity.** One `inspections` service is the only place a part is
  expanded into rows; REST and MQTT both call it. The PWA is a self-contained
  dashboard feature slice. The andon board is display-only.
- **Fast-prototyping bias:** build a vertical slice end-to-end first (one
  product, one defect, real POST → DB → dashboard), then widen. Fake the kiosk
  and offline last. Keep the STM32 terminal running in parallel until the PWA
  proves out — no big-bang cutover.

## Status — v1.0.0 shipped

All five phases below are done and deployed to the RPi. v1.0.0 is the first
joint release of the post-pivot system (web PWA inspection + STM32 andon board).

- ✅ Server, SQLite, JWT auth, dashboard, product/defect config, analytics,
  live-stations, per-part inspection model (ADR-013/016), hourly Taux NC.
- ✅ ADR-017 recorded; architecture, CLAUDE.md and docs updated.
- ✅ **Phase 1** — one `services/inspections` behind REST + MQTT; `POST
  /inspections`, `GET /kpi`, `station` role. Shipped.
- ✅ **Inspection PWA** + unified login (ADR-018): operators are login accounts
  (matricule = username), PIN flow retired. Offline queue + kiosk in place.
- ✅ **Per-product/operator epic** (ADR-019): product fiche
  (reference/client/cheatsheet), operator HR details, `GET /products/live` +
  "Produits en direct" page, quality report per-product section + operator
  productivity leaderboard. SSE live updates.
- ✅ **STM32 andon board** (ADR-020): single auto-rotating KPI screen,
  on-device severity, bounded board payload over `GET /kpi/board`.
- ✅ **Access layer:** `inspection.pmp` via dnsmasq, Caddy internal-CA HTTPS so
  the PWA installs and runs offline; cheatsheet surfaced to inspectors.
- ✅ **Operations layer:** PWA idle auto-logout + remembered-user re-login;
  configurable threshold alerts (global / per-product Taux NC, connection) with
  a dashboard notification center.
- ▶️ Next (post-v1.0.0): validate end-to-end on a station tablet during a pilot
  shift; optional per-operator drill-down report; the backlog below.

---

## Phase 1 — Server: one inspection service, two transports (½–1 day)

**Goal:** the per-part inspection logic lives in one service that both MQTT and
a new REST endpoint call; inspectors can be PIN-verified; KPIs are queryable.

- Extract `services/inspections.record_part(...)` from `mqtt/handlers.py`
  `_handle_part_inspection` (expand to rows, category_kind, part_inspection_id,
  device/operator/product resolution, optional `logged_at`).
- `POST /inspections` → validate (`PartInspectionPayload`) → `record_part`.
  Auth: the `station` role (below). Returns the created `part_inspection_id`.
- `POST /operators/verify-pin` `{operator_id, pin}` → 204 / 401. Reuses
  `app/security.py` PIN hashing. No hashes ever leave the server.
- `GET /kpi?date=` → `{taux_nc_pmp, taux_nc_inj, parts_inspected, nc_parts,
  defects_total, updated_at}` (reuse `compute_hourly_rates`/live aggregation).
- Add a `station` role to `users` (or a scoped token): may read config, verify
  PINs, POST inspections, GET /kpi — nothing else.
- Tests: `record_part` unit (single + multi-defect + OK), `POST /inspections`
  integration, `verify-pin` happy/4 01, `/kpi` shape.

**Done when:** `curl POST /inspections` (as the station account) creates the
same rows the MQTT path does, and `/kpi` returns live numbers. MQTT path
unchanged (still green).

---

## Phase 2 — Inspection PWA MVP (2–3 days)

**Goal:** a tablet-shaped web flow that logs a real part to the DB and shows up
on the dashboard. One product, full defect grids, online-only first.

- New dashboard slice `features/inspect/` with its own touch layout (big
  targets, no admin chrome): operator select → PIN → product → PMP grid → INJ
  grid → summary → submit.
- Reuse existing hooks/clients: `useProducts`, defect-types per product,
  category constants. Grids render **dynamically** from config (no hardcoding).
- Submit builds the schema-4 payload and `POST /inspections`.
- Session/auth: the tablet authenticates once as the `station` account; the
  operator+PIN step gates each session and sets `operator_id`.
- Route guard + minimal "station" login screen; keep it separate from the admin
  dashboard routes/layout.

**Done when:** on a phone/tablet browser you can log a multi-defect part and
see it in Journaux + the hourly Taux NC, identical to the STM32 path.

---

## Phase 3 — PWA hardening: offline + kiosk (1–2 days)

**Goal:** survives a Wi-Fi drop and runs locked-down on a wall tablet.

- PWA manifest + service worker (installable, fullscreen, standalone).
- **Offline queue in IndexedDB:** if `POST /inspections` fails, persist and
  retry on reconnect (Background Sync where supported, else a foreground
  drain). Show a clear online/offline + pending-count indicator.
- Config caching: last-known products/defect-types cached so a station works
  through a brief outage.
- Kiosk: document the Android kiosk setup (managed kiosk / launcher), screen
  wake-lock, and powered-mount requirement. (Deployment task, not code.)

**Done when:** pulling Wi-Fi mid-shift queues parts locally and they drain in
order on reconnect, with nothing lost; the tablet boots straight into the PWA.

---

## Phase 4 — STM32 andon KPI board (1–2 days)

**Goal:** the repurposed device shows big live KPIs for the room.

- New firmware app (or a stripped build of the existing project): Wi-Fi connect
  → **HTTP GET `/kpi`** every N seconds → render big numbers (Taux NC PMP/INJ,
  parts inspected, NC count) via TouchGFX wildcards. Fallback/option: MQTT
  subscribe to retained `qc/display/kpi` (reuses the working coreMQTT stack) if
  HTTP-over-AT is awkward — the server can publish KPIs on each inspection.
- Delete from the device: login, product/defect grids, commit flow, offline
  queue, SNTP, session.
- Keep: Wi-Fi/transport, config-store creds, TouchGFX rendering, a couple of
  wildcard number widgets, the connection indicator.

**Done when:** logging a part anywhere updates the wall board within a few
seconds; no input on the device.

---

## Phase 5 — Pilot prep & cutover (parallel, ongoing)

- Run the STM32 terminal and one tablet **in parallel** at a station; compare
  speed/UX against paper (PoC goal 1) and each other.
- Procurement: 1–2 industrial tablets, mounts, power; kiosk image.
- Security pass: `station` token scope, PIN policy, TLS for the tablet→server
  hop (Caddy), broker auth only if MQTT is used.
- Decommission the STM32 *inspection* firmware once the PWA is accepted; keep
  the andon board.

---

## Planned features (backlog — sequence after the MVP slice lands)

The web surface is the **product differentiator and selling point**, so UX
investment is a first-class workstream, not polish-at-the-end.

**Shipped in v1.0.0 (was backlog):**

- ✅ **Rich, interactive dashboard UX** — live-updating charts (SSE), animated
  transitions, an engaging tablet inspection flow, the notification center.
  Treated as a first-class workstream, kept out of business logic.
- ✅ **Auto-generated operator credentials** — landed as **login accounts**, not
  PINs (ADR-018 superseded the PIN sketch). `POST /operators {name}` mints a
  unique username + password returned **once** (`OperatorWithCredentials`, hash
  only stored); `POST /operators/{id}/regenerate-password` rotates it. Retained
  operators config is republished on create/regenerate.
- ✅ **Period quality report** — shipped as **browser-print** (no server-side
  PDF endpoint): the dashboard report page renders Taux NC per category, top
  defects, by-operator, and trend from the existing analytics endpoints, and the
  responsable prints/saves it from the browser.

**Genuinely future (behind flags, post-pilot):**

- Photo/attachment capture on a defect (see architecture.md §9 for the seam).
- MES / ERP integration (read export + after-commit push).
- Multi-plant / multi-tenant (`plant_id` scoping + JWT claim).
- Per-operator drill-down report; role-based dashboards.

## What we deliberately are NOT doing now

- Rebuilding the server, data model, or dashboard — reused wholesale.
- HTTP-over-AT on the device unless the andon board needs it (MQTT subscribe is
  the low-effort fallback).
- Per-inspector accounts — operators + PIN is enough (ADR-017).
- Photos/attachments, MES integration, multi-plant — post-pilot, behind flags.

## Risks to watch

- **Tablet kiosk/MDM** is the real-world friction, not the code. Pin down the
  device + kiosk standard early (Phase 3) so the pilot isn't blocked on it.
- **PWA offline correctness** (ordering, dedupe, no double-submit) — test the
  Wi-Fi-drop path explicitly; reuse the schema-4 idempotency thinking.
- **Two UIs in one app** — keep `inspect/` and admin strictly separate
  (layouts, route trees, ideally a distinct PWA entry/build) so the kiosk
  bundle stays small and locked-down.
