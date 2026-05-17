# Post-PoC TODO

Items deferred from Phase 1 and Phase 2 audits. **Do not work on these
during the PoC.** They represent reasonable engineering improvements
that don't affect whether the PoC validates its thesis.

Pick this file up if and only if:
- The pilot is successful and the project graduates to production scope
- A specific item becomes a blocker for an actual demo or pilot day
- You're onboarding a new engineer and need a "what's the technical debt" tour

## Why these are parked, not fixed

The PoC thesis is: can operators digitalize defect logging faster than
paper, can the QC responsable configure and monitor from the web, do
patterns emerge that paper missed? None of the items below affect
whether those questions get answered.

---

## Source audits

- `docs/audits/phase-1-audit.md` (run 2026-05-16)
- `docs/audits/phase-2-audit.md` (run 2026-05-17)

---

## Server-side items

### From Phase 1 audit

#### Phase 1 🟡-8 — `send_device_command()` has no REST endpoint

**File:** `server/app/mqtt/publisher.py`

`send_device_command(device_id, payload)` is implemented and `CmdPayload`
is defined, but no router exposes it. The Devices page has no
Reload/Reboot buttons as a result. The MQTT side is ready; only a thin
router is missing.

**Cost to fix:** ~30 min. Single route in `routers/devices.py` calling the
publisher.

---

#### Phase 1 🟡-9 — Two mypy errors in `app/logging.py` (loguru integration typing)

Pre-existing framework-integration issues at lines 13–14 and 17–18.
Not bugs at runtime — loguru's sink type does not satisfy mypy's
`TextIO` expectation. Will resolve itself when loguru ships improved
type stubs.

**Cost to fix:** 15 min with a `# type: ignore` comment, or wait for
upstream loguru typing improvement.

---

#### Phase 1 🟡-13 — `admin/mqtt/republish-retained` documented but not implemented

**File:** `docs/deployment.md` (section on post-Mosquitto-wipe recovery)

The deployment guide documents:
```
curl -X POST http://<rpi-ip>:8000/api/v1/admin/mqtt/republish-retained
```
This endpoint does not exist. A plant operator following the guide
after a Mosquitto wipe will get a 404. ADR-003 says `deploy.sh`
handles re-publish automatically on first boot, but the documented
manual fallback is broken.

**Cost to fix:** ~45 min. Add an admin-only endpoint that calls
`publish_defect_config()` and `publish_operators()`.

---

#### Phase 1 🟢-2 — Four missing ADRs (server decisions)

Architectural decisions visible in code but not recorded:
1. **SHA-256 for operator PINs, argon2 for user passwords** — the MCU
   compatibility reasoning is partially in `mqtt-topics.md` but the
   security trade-off and format (`sha256:<salt>:<digest>`) deserve a
   decision record.
2. **SQLite WAL mode** (`db.py` PRAGMA) — WAL changes crash recovery
   semantics and enables concurrent reads. Not documented anywhere.
3. **paho-mqtt `loop_start()` threading model** (`bridge.py`) — choice
   of dedicated thread vs. async was implicit. Matters if server ever
   migrates to full async.
4. **JWT in `Authorization` header vs. cookie** (`deps.py` `HTTPBearer()`)
   — cookie auth would be CSRF-safer for browser clients. The choice
   was never documented.

**Cost to fix:** ~1 hour of writing, no code changes.

---

#### Phase 1 🟢-6 — `python:3.11-slim` base image not pinned to digest

**File:** `server/Dockerfile`

`python:3.11-slim` can resolve to a different patch release between
builds. Acceptable PoC trade-off. Pin to `python:3.11.X-slim` or a
sha256 digest for production images.

**Cost to fix:** One-line change. Do it when tagging a production image.

---

#### Phase 1 🟢-7 — `infra/CLAUDE.md` layout table describes `infra/scripts/` but scripts live at `scripts/`

Minor doc drift. Fix when next editing that file.

---

#### Phase 1 🟢-9 — Tests import private schemas (`_OperatorRef`, `_DefectTypeRef`)

**Files:** `server/app/schemas/log.py`, `tests/integration/test_defect_logs.py`

The underscore prefix signals "internal". Tests importing private names
is a coupling smell. Either export them (drop underscore) or restructure
tests to not need direct schema construction.

**Cost to fix:** ~20 min refactor.

---

## Dashboard-side items

### From Phase 2 audit

#### Phase 2 🟡-1 — `window.confirm()` in 3 archive operations

**Files:**
- `dashboard/src/features/defect-types/DefectsPage.tsx:227,243`
- `dashboard/src/features/operators/OperatorsPage.tsx:138`

Native dialog ignores branding, blocks the event loop, and is
suppressed in some enterprise browser security modes. Acceptable for
PoC; replace with the existing `Modal` component if a stakeholder
objects during the demo.

**Cost to fix:** ~15 lines per site × 3 sites = ~1 hour.

---

#### Phase 2 🟡-2 — 3 ESLint `react-refresh/only-export-components` errors

Currently masked by `continue-on-error: true` in CI. Files:
- `dashboard/src/components/shared/DateRangePicker.tsx` (lines 40, 46) —
  exports component + utility functions (`daysAgo`, `today`) from the
  same file. Move utilities to `src/lib/format.ts`.
- `dashboard/src/hooks/useAuth.tsx` (line 59) — exports `AuthProvider`
  (component) and `useAuth` (hook) from the same file.

**When fixing:** also remove `continue-on-error: true` from the lint
step in `.github/workflows/ci.yml`, or these will silently regrow.

**Cost to fix:** ~30 min. Also removes `continue-on-error` from CI.

---

#### Phase 2 🟡-3 — Hardcoded brand hex values in `AnalyticsPage.tsx`

**File:** `dashboard/src/features/analytics/AnalyticsPage.tsx:9-12,43`

Four constants duplicate `index.css` CSS variables. Additionally
`strokeWidth={2}` on Recharts `<Line>` conflicts with the
VISUAL_IDENTITY.md spec (1.5). If the brand palette is adjusted, chart
colors drift from the rest of the UI.

**Cost to fix:** ~10 min. Read CSS variables via `getComputedStyle`, or
extract a small `useChartColors()` hook.

---

#### Phase 2 🟡-4 — Emoji in DefectsPage empty state

**File:** `dashboard/src/features/defect-types/DefectsPage.tsx:275`

`🗂️` is the only emoji in the codebase and it's on the primary
configuration page — the first thing the QC responsable sees before
setting up categories. Replace with a Lucide `FolderOpen` or `Layers`
icon via the project's `Icon` wrapper.

**Cost to fix:** 2 min.

---

#### Phase 2 🟡-5 — No `include_archived` toggle in Operators/DefectTypes pages

The API layer already accepts `includeArchived` in both `listOperators()`
and `listCategories()`/`listTypes()`. Archived records are currently
invisible from the dashboard with no way to review or restore them.

**Cost to fix:** ~5 lines per page × 2 pages = ~30 min.

---

#### Phase 2 🟡-8 — Bundle is 879 kB uncompressed (Recharts is the cause)

Vite warns on every build. Recharts is only used on the Analytics page.
`React.lazy` on `AnalyticsPage` gets the main chunk under 500 kB; the
Analytics chunk loads on demand.

Meaningful on plant-floor Wi-Fi if first-load latency becomes a
complaint. Not meaningful for demo day on a fast connection.

**Cost to fix:** ~15 min. `const AnalyticsPage = lazy(() => import(...))`,
wrap in `<Suspense>`.

---

#### Phase 2 🟢-1 — `lib/feature-flags.ts` with `useFlag()` hook not created

`dashboard/CLAUDE.md` specifies `src/lib/feature-flags.ts` with a
`useFlag("flag_name")` hook. No consumers call it yet. Create this before
any Phase 3 code needs to gate dashboard behavior behind a flag — without
it, someone will reach for raw TanStack Query instead and duplicate the
pattern.

**Cost to fix:** ~20 min.

---

#### Phase 2 🟢-2 — pnpm pinned in Dockerfile (9.15.9) but unpinned in CI (`version: 9`)

**Files:** `.github/workflows/ci.yml:68`, `dashboard/Dockerfile:6`

A pnpm patch release could change lockfile handling between a CI run and
a Docker build. One-line fix in `ci.yml`.

---

#### Phase 2 🟢-3 — Four missing Phase 2 ADRs (dashboard decisions)

`docs/decisions.md` ends at ADR-012 (Phase 1). No entries for Phase 2:
1. **TanStack Query** over SWR / React Query v4.
2. **react-hook-form + Zod** over Formik + Yup.
3. **React Router v6** with `RequireAuth` guard pattern.
4. **JWT in `localStorage`** rather than httpOnly cookies — a deliberate
   security trade-off that must be recorded. `localStorage` is accessible
   to injected scripts (XSS risk); httpOnly cookies are not. The server's
   CORS policy already supports cookies. The choice was implicit.

**The localStorage entry is the most important.** Anyone reading the code
later may change it without knowing the trade-off was deliberate.

**Cost to fix:** ~1 hour of writing.

---

#### Phase 2 🟢-4 + 🟢-5 — Inline styles bypassing design tokens

Three locations where a token didn't "just work" and the developer
reached for inline style instead:
- `AppShell.tsx:10` — `style={{ background: '#FAEEE3' }}` → should be `bg-cream`
- `Sidebar.tsx:58` — `background: '#0E353C'` → should be `bg-brand-deep`
- `Login.tsx:82,96` — `style={{ '--tw-ring-color': 'rgba(212, 183, 101, 0.4)' }}` →
  redundant; the global `*:focus-visible` rule in `index.css` already
  applies the correct ring project-wide.

Fix when next editing each file. Not worth a dedicated commit.

---

#### Phase 2 🟢-6 — No "syncing to devices" indicator after defect-type mutations

`dashboard/CLAUDE.md` specifies: *"After a defect mutation, show a
'syncing to devices' indicator that resolves when the server confirms the
MQTT publish."*

Reality: the toast fires on DB write and says "configuration envoyée aux
appareils" without verifying device receipt. The server returns
`config_version` on mutations; the Devices page shows per-device
`config_version`. The wiring between them was never done.

This is the one item a sharp QC responsable will notice on pilot day
if they're watching the Devices page while making a config change.
**Fix before the pilot if doing one.**

**Cost to fix:** ~2 hours. Poll `GET /devices` after mutation, compare
`config_version`, resolve the indicator when all active devices match.

---

## Process / documentation items

#### Endpoint pair completeness rule

**Recurring pattern caught twice:** Phase 1 🟡-2 (`/flags` GET missing
from router), Phase 2 🔴-2 + 🔴-3 (`/flags` path wrong, PUT not wired
in UI). When introducing a read endpoint, explicitly verify the write
endpoint exists — or explicitly defer with a note. Codify in
`docs/principles.md` or a review checklist when next reviewing
principles.

---

## Closed since audits — do NOT carry forward

Items resolved by Phase 1 batch cleanup (commits `27f4955`, `8296804`,
`7602d43`) or Phase 2 Batch 1 (commits `13b4b27`, `5439b54`, `141bd47`,
`7ab0a7c`, `db84b54`, `086ea55`):

| Item | What closed it |
|------|---------------|
| Phase 1 🔴-1 · Four failing tests (401 vs 403) | Fixed in Phase 1 batch cleanup |
| Phase 1 🔴-2 · JWT_SECRET insecure default | `27f4955` remove insecure defaults |
| Phase 1 🔴-3 · Dockerfile not using `uv.lock` | `27f4955` align Dockerfile with lock file |
| Phase 1 🟡-1 · `health/detailed` returned a stub | Fixed in batch cleanup; endpoint now returns `db`, `mqtt_broker`, `config_version`, `devices` |
| Phase 1 🟡-2 · `/flags` REST endpoints absent | Fixed in batch cleanup; router mounted at `/flags` |
| Phase 1 🟡-3 · API path mismatches (spec vs code) | Fixed; spec updated to match implemented paths |
| Phase 1 🟡-4 · `POST /operators` required PIN | Fixed; create accepts `name` only, PIN set separately |
| Phase 1 🟡-5 · `DeviceRead` missing `online` field | Fixed before Phase 2 audit |
| Phase 1 🟡-6 · `DefectCategoryRead` missing `defect_count` | Fixed before Phase 2 audit |
| Phase 1 🟡-7 · `include_archived` not wired in router | Fixed server-side before Phase 2 audit |
| Phase 1 🟡-9 · mypy errors in `stats.py` and `handlers.py` | `8296804` fix mypy errors (loguru typing errors remain, see above) |
| Phase 1 🟡-10 · prod compose defaults to `latest` | `8296804` require explicit `QC_VERSION` |
| Phase 1 🟡-11 · dashboard no healthcheck in prod compose | Fixed in batch cleanup |
| Phase 1 🟡-12 · `InsecureKeyLengthWarning` in tests | Fixed when `jwt_secret` became required (no default) |
| Phase 1 🟡-14 · `CLAUDE.md` said Phase 0 | Fixed in batch cleanup |
| Phase 1 🟢-1 · 6 ruff F401 unused imports | `7602d43` post-audit batch-3 cleanup |
| Phase 1 🟢-3 · `*.db` not in `.gitignore` | Already present (`.gitignore` lines 65–68) — audit finding was wrong |
| Phase 1 🟢-4 · `seed_dev.py` not implemented | `086ea55` enhance seed_dev.py |
| Phase 2 🔴-1 · jsdom missing, zero tests | `7ab0a7c` install jsdom + `db84b54` add MSW smoke tests |
| Phase 2 🔴-2 · Settings calls `/feature-flags` (wrong path) | `13b4b27` correct feature flags API path |
| Phase 2 🔴-3 · No flag toggle on Settings page | `5439b54` add feature flag toggle UI |
| Phase 2 🟡-6 · GET+PUT endpoint pair half-wired (informational) | Subsumed by `5439b54` (PUT now wired) |
| Phase 2 🟡-7 · `defect_count` ignored, re-computed client-side | `141bd47` use server-authoritative defect_count |

---

## Estimated total cost

If you ever do all of this in one batch:
- Server side: ~3 hours (🟡-8 endpoint + 🟡-13 republish + ADRs + minor items)
- Dashboard side: ~4 hours (🟢-6 syncing indicator is the expensive one)
- ADRs (all 8): ~1 hour of writing
- Total: roughly one focused day

No item individually is hard. The collective weight is what made
deferring the right call during the PoC.
