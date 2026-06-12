# Painting QC Digitalization — Project Dossier

> A complete, self-contained description of the system, its scope, and the
> factual inputs needed to prepare a **project presentation**, a **work-value
> estimate**, and **legal / financial** framing. Written so a reader with no
> prior context understands the whole project. Figures marked *(approx.)* are
> estimates to be validated.

---

## 1. Executive summary

**What it is.** A proof-of-concept (PoC) system that **digitalizes paper-based
quality-control logging** in a paint-finishing plant. Instead of inspectors
writing defects on paper sheets, they tap them into a **touch web app (PWA)** on
a station tablet; the QC manager configures products and defect types and watches
patterns in real time from a **web dashboard**; and a wall-mounted **electronic
"andon" board** (a repurposed STM32 microcontroller display) shows the live
quality KPIs for the room.

**Why it matters.** Paper QC sheets are slow to fill, impossible to analyze in
real time, easy to lose, and give no live feedback to the shop floor. This system
makes defect logging at least as fast as paper, surfaces patterns (by time,
defect type, operator, product) that are invisible on paper, and puts a live
quality number on the wall.

**Maturity.** Working PoC, **deployed on real hardware** (Raspberry Pi server +
STM32 andon board), demonstrated end-to-end. It is a pilot-ready prototype, not
yet a hardened multi-plant commercial product.

**Disciplines involved.** Full-stack web (Python backend + React/TypeScript
front-end + offline PWA), **embedded firmware** (STM32 / FreeRTOS / TouchGFX,
Wi-Fi over an ESP-01 module), **IoT messaging** (MQTT), and **DevOps**
(containerization, CI/CD, on-prem networking with local DNS and TLS).

---

## 2. The problem and the solution

**Today (paper):** an inspector inspects a painted part, and on a paper sheet
ticks the defects they see (in two families: *PMP* surface defects and
*Injection* defects). The sheets pile up; the QC manager keys them into a
spreadsheet later, if at all; trends are discovered days later or never; the shop
floor has no live signal of how the room is doing.

**The PoC must prove three things:**
1. Inspectors can log defects **at least as fast as on paper**.
2. The QC manager can **configure a defect type from the web and see it appear in
   the inspection app within seconds** — no device reflashing.
3. The dashboard **surfaces patterns** (time-of-day, defect type, operator,
   product) that paper hides.

**The solution (digital):** a touch-optimized inspection app on a tablet at each
station, a configuration-and-analytics dashboard for the QC manager, a shared
backend that records every inspection, and a wall display that shows the live
"Taux NC" (non-conformity rate) and parts-inspected count.

---

## 3. System architecture (one paragraph + diagram)

Inspectors use a **web PWA** on a station tablet: they sign in (matricule +
password), pick a product, tap defects across two dynamically-rendered grids
(PMP + Injection), and submit one **part inspection** to the backend. The QC
manager manages products, defect types and operators in the **same web app**;
config changes are picked up by the PWA on its next fetch. The **FastAPI backend**
(on a Raspberry Pi, in Docker) records each part, expands it into per-defect rows
through a single shared service, and exposes KPIs and reports. A repurposed
**STM32 andon board** on the wall polls a bounded KPI endpoint over Wi-Fi and
renders big live numbers. Everything server-side runs in containers on the Pi;
tablets reach it over HTTPS at a friendly local hostname.

```
                         ┌──────────────────────────── Plant LAN / Wi-Fi ───────────────────────────┐
                         │                                                                           │
  ┌──────────────┐  HTTPS │   ┌───────────────── Raspberry Pi 4B (Docker) ─────────────────┐         │
  │ Station       │ ◄─────┼──►│  Caddy (TLS, reverse proxy)                                  │         │
  │ tablet (PWA)  │       │   │   ├─ React dashboard + inspection PWA (static bundle)        │         │
  │  - inspect    │       │   │   └─ /api → FastAPI (Uvicorn)                                 │         │
  │  - offline q. │       │   │           ├─ SQLite (WAL)                                     │         │
  └──────────────┘       │   │           └─ paho-mqtt bridge ─► Mosquitto broker             │         │
                         │   │   dnsmasq → inspection.pmp = the Pi's current IP              │         │
  ┌──────────────┐  HTTP  │   └─────────────────────────────────────────────────────────────┘         │
  │ STM32 andon   │ ◄─────┼────────  GET /kpi/board  (poll, HTTP keep-alive)                           │
  │ board (wall)  │       │                                                                            │
  │  + ESP-01 WiFi│       └────────────────────────────────────────────────────────────────────────┘
  └──────────────┘
```

---

## 4. Components in detail

### 4.1 Backend server (`server/`)
- **Role:** the single source of truth. Authentication, product/defect/operator
  configuration, inspection ingest, KPI aggregation, reporting, and a (lightly
  used) MQTT bridge for the andon board and any future devices.
- **Stack:** Python 3.11, **FastAPI** + Uvicorn, **SQLAlchemy 2.0** + **Alembic**
  migrations, **SQLite** (WAL mode), **paho-mqtt**, **JWT** auth, **argon2**
  password/PIN hashing. Packaged as a multi-stage Docker image.
- **Shape:** ~**4,000 lines** of application code across **15 route modules
  (≈46 REST endpoints)**, **7 data models**, **16 service modules**, **10
  database migrations**, with **~2,260 lines of tests** in **20 test files**.
- **Key design rule:** one transport-agnostic `services/inspections` module
  expands a submitted part into per-defect rows; both the REST endpoint and the
  legacy MQTT handler go through it, so the contract can't diverge.

### 4.2 Admin dashboard (`dashboard/`)
- **Role:** the QC manager's cockpit — manage products, per-product defect types
  (two categories, 12-per-category cap), operators (with auto-generated
  credentials), and view analytics (hourly trends, per-product and per-operator
  breakdowns, a printable quality report), live-station presence, and settings.
- **Stack:** **React 18/19 + TypeScript + Vite**, **TailwindCSS + shadcn/ui**,
  **TanStack Query**, **React Router**, **Zod**, **Recharts**. Served as a static
  bundle by Caddy.
- **Shape:** ~**7,500 lines** of TS/TSX across **13 feature slices**, **74
  component files**, **15 test files** (Vitest + React Testing Library).
- **Notable UX investment:** animated, interactive UI (count-up tiles, page
  transitions, live flashes, SSE live updates) — the web surface is treated as
  the product's primary selling point.

### 4.3 Inspection PWA (part of `dashboard/`, `features/inspect/`)
- **Role:** the inspector's touch app on the station tablet — a separate,
  kiosk-styled bundle in the same codebase. Operator login → product pick →
  PMP/Injection defect grids (rendered from the product's live config) → summary
  → submit.
- **Offline-first:** a **service worker** caches the app shell so the kiosk loads
  without Wi-Fi, and an **IndexedDB queue** holds submitted parts when offline and
  drains them on reconnect. Connectivity badge, wake-lock to keep the screen on,
  heartbeat presence.
- **Document feature:** the QC manager can upload a "fiche défauts" (a defect
  reference document, PDF or image); inspectors open it full-screen while logging.

### 4.4 Andon KPI board firmware (`firmware/qc_andon`, a Git submodule)
- **Role:** a **display-only** wall board showing live Taux NC / parts inspected
  for the room. No input.
- **Hardware/stack:** **STM32H7B3I-DK** (Cortex-M7 @ 280 MHz, 4.3" 480×272 touch
  LCD, 16 MB SDRAM, 64 MB Octo-SPI), **TouchGFX 4.x** UI, **FreeRTOS**, Wi-Fi via
  an external **ESP-01 (ESP8266)** module over UART/AT commands (the module owns
  the TCP/IP stack — no LwIP on the MCU).
- **Behaviour:** fetches a bounded JSON KPI payload over HTTP (with connection
  keep-alive, ~2 s poll), parses it without dynamic allocation, computes severity
  on-device against configurable thresholds, and renders a multi-scene,
  auto-rotating animated UI (radial gauge, per-product cards, top-defect
  spotlight, a critical-alert scene) with day/night theming and touch-to-advance.
- **Shape:** ~**3,000 lines** of application/driver C/C++ (ESP-01 transport, KPI
  client, JSON parser, logging) + ~**2,500 lines** of TouchGFX GUI C++.
- **Repository:** public, `github.com/malekboubahri2/qc_andon`, included in the
  main repo as a submodule under `firmware/`.

### 4.5 Infrastructure (`infra/`)
- **Containerized stack** via Docker Compose: FastAPI server, Mosquitto broker,
  the dashboard/PWA (Caddy), and a small **dnsmasq** appliance for a friendly LAN
  hostname. Multi-arch images (amd64 for dev, **arm64** for the Pi).
- **Networking:** the Pi sits on the plant LAN at a fixed/reserved address;
  **dnsmasq** resolves **`inspection.pmp`** to the Pi's current address; **Caddy**
  terminates **HTTPS** with an internal CA (and on-demand certificates), which is
  required for the PWA's service worker and installability.
- **CI/CD:** **GitHub Actions** builds and publishes versioned multi-arch images
  to **GHCR**; a deploy script ships the stack to the Pi over SSH (or builds on
  the Pi).

---

## 5. Technology stack (full)

| Layer | Technologies |
|---|---|
| Backend | Python 3.11, FastAPI, Uvicorn, SQLAlchemy 2.0, Alembic, SQLite (WAL), paho-mqtt, PyJWT, argon2-cffi, Pydantic, pytest |
| Front-end | React 18/19, TypeScript, Vite, TailwindCSS, shadcn/ui, TanStack Query, React Router, Zod, Recharts, Vitest |
| PWA | Service worker (app-shell cache), IndexedDB offline queue, Web App Manifest, Screen Wake Lock |
| Messaging | MQTT (Eclipse Mosquitto broker), versioned JSON payloads |
| Firmware | C/C++, STM32 HAL (STM32CubeIDE/CubeMX), FreeRTOS (CMSIS-RTOS2), TouchGFX 4.x, ESP-01/ESP8266 AT-command Wi-Fi |
| Infra/DevOps | Docker, Docker Compose, Caddy (reverse proxy + TLS), dnsmasq, GitHub Actions, GHCR, multi-arch (amd64/arm64) |
| Hardware | Raspberry Pi 4B 8GB, STM32H7B3I-DK, ESP-01, Android/Windows tablets |

---

## 6. Feature inventory

**Configuration (QC manager)**
- Products with reference, client, free-text cheatsheet, and an uploaded defect
  reference document (PDF/image).
- Per-product defect types in two plant-wide categories (PMP, Injection), capped
  at 12 user types per category, with an auto-managed "Other" fallback.
- Operators as login accounts (matricule = username) with auto-generated,
  reveal-once credentials and password rotation; HR details.
- Live feature flags (DB-backed, cached).

**Inspection (inspector PWA)**
- Matricule + password sign-in; the server attributes the part to the operator.
- Dynamic PMP/Injection defect grids from the product's live config.
- One-tap defect selection, free-text "Other" notes, part summary, submit.
- Offline queue (IndexedDB) with automatic drain on reconnect; connectivity
  indicator; kiosk fullscreen + wake-lock; in-app full-screen document viewer.

**Analytics & reporting (dashboard)**
- Live "Taux NC" and parts-inspected KPIs; hourly trend buckets.
- Per-product activity ("Produits en direct") with SSE live updates.
- Per-product and per-operator breakdowns; operator productivity leaderboard.
- Printable quality report (browser print → PDF).
- Live station presence (heartbeat) and device/operator status.

**Andon wall board (firmware)**
- Live Taux NC radial gauge, parts/NC counts, per-product cards, top-defect
  spotlight, critical-alert scene; auto-rotation; on-device severity thresholds;
  day/night theme; ~2 s refresh.

**Platform**
- JWT auth with three roles (admin, operator, station); argon2 hashing.
- Versioned API and MQTT schemas; soft deletes only (no hard deletes).
- Friendly HTTPS hostname on the LAN; installable offline PWA.

---

## 7. Hardware bill of materials *(approx., one room/pilot)*

| Item | Purpose | Qty | Unit cost *(approx.)* |
|---|---|---|---|
| Raspberry Pi 4B 8 GB (+ PSU, storage, case) | On-prem server | 1 | $90–130 |
| STM32H7B3I-DK Discovery kit | Andon wall board | 1 | $80–110 |
| ESP-01 (ESP8266) Wi-Fi module | Board Wi-Fi | 1 | $2–4 |
| Android or Windows tablet (+ powered wall/stand mount) | Station inspection client | 1 per station | $150–450 each |
| Network/Wi-Fi, mounts, cabling, enclosure | Install | — | varies |

> Deployment is **on-premise** with **no cloud subscription**, so recurring cost
> is essentially electricity + maintenance. Costs are indicative; localize to the
> deployment region and current prices.

---

## 8. Data model (summary)

Core tables: `products`, `defect_types`, `inspection_logs` (per-defect rows
grouped by a shared `part_inspection_id`), `operators` (1:1 to a login `users`
row), `devices`, `users`, `feature_flags`. Rules enforced server-side: never
hard-delete (use `active` + `archived_at`); every defect row carries device,
operator, product, defect type, optional note, device time, and server time; the
two defect categories are plant-wide constants, not data; schemas are versioned
and validated on both ends. **20 architecture decision records (ADR-001…020)**
document the evolution (e.g., the pivot from an STM32 inspection terminal to a web
PWA, per-part inspections, operator-as-login accounts, the bounded andon payload).

---

## 9. Security & data privacy (factual basis — not legal advice)

- **Authentication:** JWT bearer tokens; passwords and PINs hashed with argon2;
  role-based access (admin / operator / station). Credentials are generated
  server-side and revealed once.
- **Transport:** HTTPS on the LAN via Caddy (internal CA / on-demand certs); the
  andon board uses plain HTTP to a bounded read-only KPI endpoint.
- **Personal data processed:** operator identifiers (name, matricule), login
  credentials (hashed), and **per-operator productivity / inspection records** —
  this is **employee personal data**, which typically triggers data-protection
  obligations (e.g., Tunisia's personal-data protection law and the INPDP
  authority; the EU GDPR if EU data subjects or clients are involved). Worker
  performance monitoring is a sensitive area in many jurisdictions.
- **Data residency:** all data stays **on-premise** on the plant's Pi (SQLite +
  uploaded files on a local volume); no third-party cloud processor by default.
- **For commercialization:** a privacy notice, lawful basis, retention policy,
  access controls review, and (if monitoring operators) consultation requirements
  should be confirmed with a qualified data-protection professional.

---

## 10. Engineering practices (evidence of quality)

- **Modular, layered architecture** with strict dependency direction
  (routers → services → models; no business logic in routers or UI views).
- **20 ADRs** documenting every significant decision and its trade-offs.
- **Automated tests:** ~20 backend test files (service + integration), 15
  front-end test files; ~2,260 lines of backend tests.
- **CI/CD:** GitHub Actions building versioned multi-arch images to GHCR; scripted
  deploy to the Pi.
- **Containerized, reproducible** dev and prod from the same images; healthchecks,
  restart policies, named volumes.
- **Portability by design:** environment-driven config, hardware behind a HAL,
  pluggable network transport in firmware.

---

## 11. Project scope & effort indicators (for work-value estimation)

> Inputs for a valuation; the actual figure depends on local day-rates, who owns
> the IP, and whether this is priced as a PoC or a product.

**Custom source code (excludes dependencies/generated code):**
| Component | Lines of code *(approx.)* |
|---|---|
| Backend (app) | 4,000 |
| Backend (tests) | 2,260 |
| Dashboard + PWA (TS/TSX) | 7,500 |
| Firmware app/drivers (C/C++) | 3,000 |
| Firmware TouchGFX GUI (C++) | 2,500 |
| **Total custom code** | **≈ 19,300 lines** |

**Breadth multiplier (why this is more than its line count):** the project spans
**four normally-separate specialties** — backend web services, a polished
React/TypeScript front-end **plus an offline PWA**, **bare-metal embedded firmware**
(RTOS + GPU-less graphics + AT-command Wi-Fi), and **DevOps/IoT** (Docker, CI/CD,
MQTT, on-prem DNS/TLS). Each is a distinct skill set; integrating them into one
working, deployed system is the bulk of the value.

**Tangible deliverables for the estimate:** ~46 REST endpoints; 10 DB migrations;
13 front-end feature areas; a full embedded UI with 5 animated scenes; a
containerized multi-service stack with CI/CD and one-command deploy; 20 ADRs and
12 docs; ~35 test files; a working installation on real hardware.

**Suggested framing for the costing chat:** treat it as a **multi-disciplinary
full-stack + embedded PoC** delivered to a **pilot-ready** state, and estimate
person-effort by component (backend, front-end/PWA, firmware, DevOps) at local
senior-engineer rates, with a premium for the cross-domain integration and the
embedded work. (This document intentionally does not assert a single number —
feed it to the valuation step with your local rates.)

---

## 12. Deployment & operations

- **Server:** Docker Compose stack on the Raspberry Pi; updates via `git pull` +
  image rebuild/recreate; database migrations run on server restart.
- **Front-end:** static bundle rebuilt and re-served by Caddy on deploy.
- **Andon board:** firmware flashed via on-board ST-LINK; Wi-Fi/server config in
  on-device storage.
- **Networking:** Pi on the plant LAN (static/reserved IP); dnsmasq for
  `inspection.pmp`; Caddy for HTTPS (one-time root-CA install on tablets).
- **Operability:** healthchecks, structured JSON logs, restart-on-failure, local
  backups of the SQLite database.

---

## 13. Current status & roadmap

**Done & deployed:** the web-PWA pivot, the shared inspection service behind REST
(+ legacy MQTT), operator-as-login accounts, the per-product/operator analytics
epic with live updates, the andon board firmware (live data, animated UI,
keep-alive polling), the friendly-domain HTTPS access, and the product cheatsheet
document feature — all running on the Pi.

**Next / opportunities:** end-to-end validation of the inspection PWA on locked
kiosk tablets at every station; optional per-operator drill-down report; hardening
for **multi-station / multi-plant** (the architecture is built for it but not yet
exercised at scale); optional MES/ERP integration; managed-device (MDM) rollout of
the tablets and certificate trust; automatic certificate provisioning.

---

## 14. Intellectual property & licensing (factual basis — not legal advice)

- **Custom code** (backend, dashboard/PWA, firmware, infra) is original work; the
  Git history attributes authorship. Ownership between author, employer, and/or
  client should be confirmed in writing.
- **Third-party dependencies** are open-source under permissive licenses
  (FastAPI, React, SQLAlchemy, Tailwind, TanStack Query, FreeRTOS, coreMQTT — MIT;
  others Apache-2.0/BSD), with a few specific licenses to note: **Eclipse
  Mosquitto** (EPL-2.0 / EDL-1.0), and **TouchGFX** (ST proprietary, free for use
  on STM32 microcontrollers). For any **commercial distribution**, run a license
  compliance review (attribution and redistribution terms, especially Mosquitto
  and TouchGFX, and any copyleft components).
- **Hardware platforms** (Raspberry Pi, STM32) carry their vendors' usage terms.
- The firmware repository is currently **public**; the application stack is in a
  separate repository. Confirm the intended visibility/licensing before
  commercial use.

---

## 15. Financial / cost factors (inputs, not a quote)

- **One-time hardware** per room: see §7 (server + andon board + one tablet per
  station + mounts/network).
- **Software licensing cost:** effectively **zero recurring** — the stack is
  open-source and self-hosted; no per-seat or cloud fees by default.
- **Hosting/ops cost:** on-premise; electricity + occasional maintenance only.
- **Development cost:** the dominant figure — derive from §11 effort indicators ×
  local engineering rates.
- **Scaling cost:** additional stations = additional tablets (+ minor config);
  additional plants = another Pi + andon board per site. No central cloud cost is
  introduced by scaling, by design.

---

## 16. Important disclaimers

- This dossier provides a **factual technical description and inputs**. The
  **work-value estimate, legal, and financial conclusions must be produced and
  validated by qualified professionals** (a software-valuation specialist, a
  lawyer for IP/licensing/data-protection, and an accountant for costing/tax).
- All cost and effort figures are **indicative estimates**, not quotes.
- Data-protection obligations depend on jurisdiction and the deployment context
  (especially **employee monitoring** and any EU data subjects); obtain
  professional confirmation before commercial rollout.

---

*Prepared as input for a project presentation, work-value estimate, and
legal/financial review. Metrics measured from the codebase at the time of
writing; validate before external use.*
