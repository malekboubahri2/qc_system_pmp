# Phase 2 Audit — 2026-05-17

## Summary

- 🔴 3 blocking issues
- 🟡 8 issues to fix before Phase 3
- 🟢 7 notes / future concerns
- Tests: **0 passing, 0 failing** — test suite cannot run; `jsdom` missing from dependencies; Vitest exits with `No test files found` and exit code 1
- Build: `pnpm run build` exits 0. One chunk at 879 kB (> 500 kB threshold), gzip 264 kB
- CI: `pnpm test -- --run` step will fail on every push; `pnpm run lint` has 3 errors but is marked `continue-on-error: true` so CI stays green despite known failures

---

## Findings

### 🔴 Blocking

---

#### 🔴-1 · Test suite is completely broken — `jsdom` missing

**File:** `dashboard/package.json` (devDependencies), `dashboard/vite.config.ts:22`

`vitest.config` sets `environment: 'jsdom'` but `jsdom` is not listed in
`devDependencies`. Running `pnpm test -- --run` inside the container produces:

```
MISSING DEPENDENCY Cannot find dependency 'jsdom'
No test files found, exiting with code 1
```

Additionally there are zero test files anywhere under `dashboard/src/`. The
`dashboard/CLAUDE.md` mandates "One test per page rendering happy path … each
feature's tests live next to its code in `features/<name>/__tests__/`". Not a
single `__tests__/` directory exists. The roadmap Day 9–11 tasks each say
"One Vitest smoke test per page" — none were created.

Net effect: the dashboard CI step (`pnpm test -- --run`) will fail on every
push. The lint step failing is masked by `continue-on-error: true`. The test
failure is not masked; it will block any PR-gate that relies on a green CI.

**Suggested fix:** `pnpm add -D jsdom`, then add at minimum one smoke test per
feature page per `dashboard/CLAUDE.md` contract.

---

#### 🔴-2 · Settings page calls `/feature-flags` but server router is mounted at `/flags`

**Files:**
- `dashboard/src/features/settings/SettingsPage.tsx:7` — calls `client.get('/feature-flags')`
- `server/app/routers/feature_flags.py:8` — `prefix="/flags"`

The dashboard GET call will receive a 404 every time the Settings page loads.
The `flags.length > 0` guard means the feature-flags section is simply invisible
rather than showing an error, so this failure is silent. The server spec
(`docs/api-spec.md:56`) says `GET /flags`, which matches the server. The
dashboard diverges.

**Suggested fix:** Change the client call to `client.get<FeatureFlag[]>('/flags')`.

---

#### 🔴-3 · Feature flags display is read-only — no toggle capability

**File:** `dashboard/src/features/settings/SettingsPage.tsx`

The Settings page lists flags but provides no way to toggle them. The server
exposes `PUT /flags/{name}` for exactly this purpose. The `dashboard/CLAUDE.md`
states the Settings page should use feature flags. The VISUAL_IDENTITY.md and
the dashboard CLAUDE.md both imply a usable admin surface.

More critically: this is the only page where the QC responsable can interact
with flags. With no toggle, the `PUT /flags/{name}` endpoint is unreachable
from the UI. Any flag that needs to be changed requires direct API calls.
Combined with 🔴-2 (the GET also fails), feature flags are completely
non-functional in the dashboard.

**Suggested fix:** Add a mutation using `PUT /flags/{name}` and render a toggle
switch per flag in the Settings page. This is roughly 20 lines given the
existing `client` and TanStack Query patterns in the codebase.

---

### 🟡 Fix before Phase 3

---

#### 🟡-1 · `window.confirm()` used for destructive confirmations — breaks the brand standard

**Files:**
- `dashboard/src/features/defect-types/DefectsPage.tsx:227,243`
- `dashboard/src/features/operators/OperatorsPage.tsx:138`

Three archive operations use the native browser `confirm()` dialog. The
`dashboard/VISUAL_IDENTITY.md` anti-patterns list explicitly says "No alert()
ever" (CLAUDE.md extends this to destructive interactions). Native dialogs
ignore all branding, block the event loop, and are suppressed in some browser
security modes (iframes, certain enterprise policies).

**Suggested fix:** A small inline confirmation state (show a "Confirmer ?" row
or a minimal modal with Cancel/Confirmer buttons) consistent with the existing
`Modal` component already in `src/components/shared/`.

---

#### 🟡-2 · ESLint reports 3 errors — CI lint step would fail if not suppressed

**Files:**
- `dashboard/src/components/shared/DateRangePicker.tsx:40,46`
- `dashboard/src/hooks/useAuth.tsx:59`

All three are `react-refresh/only-export-components` violations:
- `DateRangePicker.tsx` exports both a component and utility functions
  (`daysAgo`, `today`) from the same file — violates fast-refresh constraints
  and the module layout spec in `dashboard/CLAUDE.md` ("shared utility functions
  belong in `lib/`").
- `useAuth.tsx` exports both `AuthProvider` (component) and `useAuth` (hook)
  from the same file.

CI runs `pnpm run lint` with `continue-on-error: true`, so these never break
the build — but they represent real structural issues. `daysAgo`/`today` are
already imported from `DateRangePicker` in both `LogsPage.tsx` and
`DashboardPage.tsx`, spreading a component-utility coupling across features.

**Suggested fix:** Move `daysAgo` and `today` to `src/lib/format.ts` (already
exists). Move `useAuth` to its own file or accept the co-location and suppress
the rule with a comment.

---

#### 🟡-3 · `AnalyticsPage` hardcodes four brand hex values — diverges from design tokens

**File:** `dashboard/src/features/analytics/AnalyticsPage.tsx:9-12,43`

```ts
const BRAND  = '#1A5560';
const ACCENT = '#D4B765';
const CREAM  = '#F5E8DC';
const MUTED  = '#6B6B6B';
```

These duplicate the CSS custom property values in `src/index.css`. If the
brand palette is adjusted (e.g. the PMP official guide later supplies
corrected hex values), the chart colors will drift from the rest of the UI.

Additionally `strokeWidth={2}` on the Recharts `<Line>` component at line 139
conflicts with the VISUAL_IDENTITY.md specification: "Stroke width: 1.5 (not
the default 2)". Lucide icons are correctly wrapped at 1.5 via `Icon.tsx`, but
chart line strokes are not.

**Suggested fix:** Use `getComputedStyle(document.documentElement).getPropertyValue('--color-brand')` or a small `useTheme()` hook that reads CSS variables for Recharts. Change `strokeWidth={2}` to `strokeWidth={1.5}` or document the intentional exception.

---

#### 🟡-4 · Emoji used as UI element in DefectsPage empty state

**File:** `dashboard/src/features/defect-types/DefectsPage.tsx:275`

```tsx
<div className="text-4xl mb-3">🗂️</div>
```

`dashboard/VISUAL_IDENTITY.md` anti-patterns: "Emoji as UI icons (use Lucide
consistently)". This is the only occurrence but it is on the primary
configuration page — the first thing a QC responsable sees when they haven't
set up defect categories yet.

**Suggested fix:** Replace with a Lucide `FolderOpen` or `Layers` icon at 32px
via the project's `Icon` wrapper.

---

#### 🟡-5 · No `?include_archived=true` toggle in any list page

**Files:** `dashboard/src/features/operators/OperatorsPage.tsx`,
`dashboard/src/features/defect-types/DefectsPage.tsx`

Both pages load only active records (the default). The API layer supports
`include_archived` in both `listOperators()` and `listCategories()`/`listTypes()`
and the server correctly implements it. But the UI exposes no way to view
archived operators or archived defect types. Archived operators can never be
reviewed or restored from the dashboard.

The `Operator.archived_at` and `DefectCategory.archived_at` fields are typed
in `src/types/index.ts` but never rendered.

This was called out as 🟡-7 in Phase 1 as a server-side gap; Phase 1 fixed the
server gap. The dashboard did not follow through.

**Suggested fix:** Add a toggle ("Afficher les archivés") per list page, wired
to the `includeArchived` parameter already accepted by the hooks.

---

#### 🟡-6 · Settings page does not expose `PUT /flags` — pattern repetition from Phase 1

**Context:** Phase 1 audit 🟡-2 flagged that `/flags` endpoints were absent.
Phase 1 remediation (commit `1dfba39`) added them to the server. Phase 2 built
the Settings page but only wired the GET. The write half of the same pattern
was again left undone. This is the second time the same endpoint pair
(GET + PUT) was only half-implemented.

This is noted separately from 🔴-3 to call out the pattern: one-directional
wiring of read/write endpoint pairs is a recurring oversight.

---

#### 🟡-7 · `defect_count` from server is ignored — UI re-computes it client-side

**File:** `dashboard/src/features/defect-types/DefectsPage.tsx:134`

The server returns `defect_count` on each `DefectCategoryRead` (Phase 1 fix).
The `DefectCategory` type in `src/types/index.ts:26` correctly includes
`defect_count: number`. But `CategorySection` ignores it:

```tsx
const count = types.length;  // re-computed from the client-side filtered array
```

The result is that the cap counter shows the count of active types currently
in the TanStack Query cache, not the server-authoritative count which includes
types that may not be loaded (e.g. archived types). In normal operation this
gives the right answer. After an archive action with stale cache it can briefly
show the wrong count, allowing the "Add" button to remain enabled when the
server would reject the request at 12.

**Suggested fix:** Change `const count = types.length` to
`const count = category.defect_count`.

---

#### 🟡-8 · Bundle is 879 kB uncompressed — Recharts accounts for most

**Build output:**
```
dist/assets/index-DCykU7BY.js  879.07 kB (gzip: 264.27 kB)
```

All application code, Recharts, React, and all other dependencies land in a
single un-split chunk. Vite warns: "Some chunks are larger than 500 kB after
minification." The dashboard CLAUDE.md has no explicit size budget, but the
RPi serves this over a plant Wi-Fi network to an iOS/Android tablet — a 264 kB
gzip payload on first load is noticeable on a weak signal.

Recharts is the primary contributor. It is only used on the Analytics page.

**Suggested fix:** Apply dynamic import to the Analytics page:
`const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage'))`.
This defers loading Recharts until the Analytics route is visited. Wrap in
`<Suspense>` with a spinner. Expected bundle split: main chunk ~350 kB,
Analytics chunk ~500 kB (load-on-demand).

---

### 🟢 Notes

---

#### 🟢-1 · `lib/feature-flags.ts` from `dashboard/CLAUDE.md` was never created

**Reference:** `dashboard/CLAUDE.md` specifies `src/lib/feature-flags.ts` with
a `useFlag("flag_name")` hook. This file does not exist. The Settings page uses
an inline `listFlags()` function instead of the specified module. No consumers
call `useFlag()` anywhere. If Phase 3 firmware work needs client-side feature
gating in the dashboard, it will be built against a spec that wasn't
implemented.

---

#### 🟢-2 · `pnpm` version in CI is `9` (unpinned) vs `9.15.9` in Dockerfile

**Files:**
- `.github/workflows/ci.yml:68` — `version: 9`
- `dashboard/Dockerfile:6` — `pnpm@9.15.9`

A pnpm patch release (e.g. 9.16.0) could change lockfile handling behavior
between the CI run and the Docker build. The Dockerfile is correctly pinned;
CI is not. Minor drift risk.

---

#### 🟢-3 · No ADRs for four Phase 2 architectural decisions

`docs/decisions.md` ends at ADR-012 (CI/CD, Phase 1). No new entries were
added during Phase 2 despite four significant choices:

1. **TanStack Query** as the server-state library (vs SWR, React Query v4).
2. **react-hook-form + Zod** for forms (vs Formik + Yup, or uncontrolled).
3. **React Router v6** with a `RequireAuth` guard pattern.
4. **Token storage in `localStorage`** rather than httpOnly cookies —
   a documented security trade-off that should be recorded given the Phase 1
   JWT hardening work.

The localStorage JWT decision is especially worth recording: `localStorage` is
accessible to any injected script (XSS risk), while httpOnly cookies are not.
The existing server's CORS policy (`allow_credentials=True`) already supports
cookies. The choice was implicit; anyone reading the code later may change it
without knowing the trade-off was deliberate.

---

#### 🟢-4 · `AppShell.tsx` uses inline style for background instead of Tailwind class

**File:** `dashboard/src/components/shared/AppShell.tsx:10`

```tsx
style={{ background: '#FAEEE3' }}
```

The cream token is defined as `--color-cream: #FAEEE3` and is usable as
`bg-cream`. The hardcoded hex bypasses the token system. If the cream value
ever changes in `index.css`, this component will not update. The Sidebar also
hardcodes `background: '#0E353C'` (brand-deep) inline at line 58.

---

#### 🟢-5 · Login form uses inline CSS variable injection for focus ring

**File:** `dashboard/src/pages/Login.tsx:82,96`

```tsx
style={{ '--tw-ring-color': 'rgba(212, 183, 101, 0.4)' } as React.CSSProperties}
```

This bypasses Tailwind's generated ring utilities and hardcodes the accent
color hex. The global `*:focus-visible` rule in `index.css` already applies
the correct gold focus ring project-wide; the inline override is redundant and
duplicates the color value. Combined with 🟢-4, there is a minor pattern of
reaching around the token system under layout/style pressure.

---

#### 🟢-6 · No "syncing to devices" indicator after defect-type mutations

**Reference:** `dashboard/CLAUDE.md`:
> After a defect mutation, show a "syncing to devices" indicator that resolves
> when the server confirms the MQTT publish (server returns config version,
> device status endpoint shows which devices have that version)

No such indicator exists on `DefectsPage`. The toast `'Type créé — configuration
envoyée aux appareils'` fires immediately on mutation success, but does not
verify which devices have actually received the new config. The server does
return a `config_version` field on `DefectCategoryRead` and the Devices page
shows per-device `config_version`. The wiring between them was not done.

Not blocking for a PoC, but the gap between the spec and the reality should
be tracked.

---

#### 🟢-7 · Root `CLAUDE.md` phase is correct but roadmap Day 12 tasks are not checked

**File:** `docs/roadmap.md:311-323`

The Day 12 task list includes:
- `[ ] Run seed script on RPi server` — no seed script exists (noted in Phase 1 🟢-4, still absent)
- `[ ] Tag a release: git tag v0.1.0` — no tag present in git log
- `[ ] Verify dashboard at http://<rpi-ip>/` — no evidence

Root `CLAUDE.md` correctly says "Phase 2 — Dashboard" which matches the current
state. The roadmap should be updated to mark completed Day 8–12 tasks as done
and carry forward the open items.

---

## Section-level results

| Section | Verdict |
|---------|---------|
| A. Roadmap vs reality | All 8 required pages are routed and implemented. CSV export (Day 10), analytics, devices, settings stub all present. PIN-set-after-create flow correctly implemented. Day 9 "One Vitest smoke test per page" is entirely absent. Seed script still missing. |
| B. Visual identity | Token config correct in `index.css`. No `font-serif`. `font-mono` used correctly on timestamps/IDs only. No `rounded-3xl`/`rounded-2xl`/`rounded-none`. Focus ring pattern mostly correct. `strokeWidth=2` in Recharts (🟡-3). Emoji in empty state (🟡-4). Hardcoded hex in `AnalyticsPage` (🟡-3). Inline style bypassing tokens in `AppShell`/`Sidebar`/`Login` (🟢-4,5). |
| C. Architecture | No cross-feature imports. `axios.create` only in `api/client.ts`. No direct `axios` imports in features. Server state in TanStack Query, not `useState`. localStorage for JWT (deliberate, undocumented — 🟢-3). `VITE_*` env vars not used outside `config.ts`. All forms use `useForm` + `zodResolver`. API layer clean. |
| D. API contract | All dashboard calls map to real server endpoints except `/feature-flags` → `/flags` (🔴-2). No unexpected 404s for other calls. `Device.online` field present and used (Phase 1 🟡-5 resolved). `defect_count` present in types (Phase 1 🟡-6 resolved) but unused in UI (🟡-7). `include_archived` parameter implemented in API layer but not surfaced in UI (🟡-5). |
| E. Operator PIN flow | Create form has no PIN field (correct). POST creates operator. Separate PIN modal wired to `POST /operators/{id}/pin` (correct). Operators with `pin_set: false` shown with warning badge. No `include_archived` toggle (🟡-5). |
| F. Devices page | `refetchInterval: 10_000` set. `online` badge rendered correctly. `config_version` and `last_seen` shown. No RSSI field (not in `DeviceRead` schema). |
| G. Feature flags UI | Settings page exists. GET calls wrong path `/feature-flags` instead of `/flags` (🔴-2). No toggle/write capability (🔴-3). `lib/feature-flags.ts` / `useFlag()` hook not created (🟢-1). |
| H. Tests | 0 tests exist. `jsdom` missing. Test suite exits with error. (🔴-1) |
| I. Build / containerization | Multi-stage Dockerfile ✓. pnpm pinned to 9.15.9 ✓. Non-root user: Caddy runs as root by default — no `USER` directive added. `HEALTHCHECK` present in Dockerfile ✓. Dashboard healthcheck in prod compose now present (Phase 1 🟡-11 resolved). `QC_VERSION` required explicitly in prod compose (Phase 1 🟡-10 resolved). Bundle 879 kB (🟡-8). |
| J. Code hygiene | No `TODO`/`FIXME`/`console.log`. No `: any` types. `tsc --noEmit` passes clean. ESLint: 3 errors (`react-refresh/only-export-components`) all `continue-on-error` masked (🟡-2). No commented-out code blocks. |
| K. Documentation drift | `dashboard/CLAUDE.md` layout matches actual structure except `lib/feature-flags.ts` never created (🟢-1). `VISUAL_IDENTITY.md` tokens match `index.css`. `docs/decisions.md` has no Phase 2 entries (🟢-3). Roadmap Day 12 tasks unchecked (🟢-7). Root `CLAUDE.md` phase correct. |
| L. Cross-cutting | Commits follow Conventional Commits. No Phase 1 module-level mutable state introduced. `dashboard/CLAUDE.md` references root principles. API contract drift caught earlier this phase (PIN flow correctly diverged from original spec). Phase 1 pattern of half-implementing endpoint pairs repeated with `PUT /flags` (🟡-6). |

---

## Recommended order of operations

1. **🔴-2 Fix `/feature-flags` → `/flags`** in `SettingsPage.tsx`. One-line change.
   Unblocks visibility of the feature flag state from the UI.

2. **🔴-1 Install `jsdom` and write smoke tests.** `pnpm add -D jsdom`. Write one
   smoke test per feature page (8 tests total) — just render + assert the page
   title appears. This is the minimum to stop the CI test step from failing on
   every push.

3. **🔴-3 + 🟡-6 Add `PUT /flags/{name}` toggle to Settings page.** With 🔴-2 fixed,
   the GET works. Add a `useMutation` call and a toggle switch component. Resolves
   the only fully broken admin workflow.

4. **🟡-1 Replace `window.confirm()`.** Three occurrences. A minimal "are you sure?"
   inline confirmation row is ~15 lines per site. Use the existing `Modal`
   component for the archive actions.

5. **🟡-7 Use `category.defect_count` instead of `types.length`** in `CategorySection`.
   One-line fix that makes the cap counter authoritative.

6. **🟡-5 Add `include_archived` toggle** to Operators and Defect Types pages.
   The API layer already supports it. A checkbox "Afficher les archivés" wired
   to the `includeArchived` hook parameter is ~5 lines per page.

7. **🟡-2 Fix ESLint errors** by moving `daysAgo`/`today` to `src/lib/format.ts`
   and splitting `useAuth` into its own file. Remove `continue-on-error: true`
   from lint step in CI once fixed.

8. **🟡-3 Fix `strokeWidth={2}`** in `AnalyticsPage.tsx`. Change to `1.5`.
   Optionally extract brand colors from CSS variables to avoid the hardcoded
   hex constants.

9. **🟡-4 Replace emoji** in `DefectsPage` empty state with a Lucide icon.

10. **🟡-8 Code-split Analytics page** with `React.lazy`. Cuts the initial bundle
    in half; meaningful on plant-floor Wi-Fi.

11. **🟢-3 Add Phase 2 ADRs** to `docs/decisions.md`. At minimum: TanStack Query
    choice, localStorage JWT trade-off. The localStorage entry is the most
    important to document before Phase 3 adds more auth-aware code.

12. **🟢-1 Create `src/lib/feature-flags.ts`** with `useFlag()` hook per spec.
    Needed before any Phase 3 code gates behavior behind flags.

13. **🟢-7 Mark roadmap checkboxes** and carry the open items (seed script, release
    tag) forward into Phase 3 backlog.
