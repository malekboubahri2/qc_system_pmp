# Dashboard — Claude Code Context

React + Vite + TS frontend, served by Caddy from a Docker container. Hosts
**two surfaces** in one codebase (ADR-017):

1. **Admin dashboard** — for the QC responsable: products/defect-types config,
   operators, analytics, Journaux, live-stations, settings.
2. **Inspection PWA** (`features/inspect/`) — the touch/kiosk app inspectors use
   on station tablets: operator login → product → PMP/INJ defect grids (dynamic
   from config) → summary → `POST /inspections`. Installable, offline (service
   worker + IndexedDB queue), fullscreen kiosk.

> The web surface is the **product's primary selling point** — invest in
> interactive, animated, polished UX. Keep motion/interaction primitives in
> `lib/` (e.g. `lib/motion`, shared components) so they're reusable and never
> leak into business logic. See root `CLAUDE.md`, ADR-017, and `docs/roadmap.md`.

**Keep the two surfaces strictly separate:** distinct route trees and layouts
(`features/inspect/` is touch-first, no admin chrome), ideally a separate PWA
entry/build so the kiosk bundle stays small and locked-down. They share only
`api/`, `hooks/`, `lib/`, `types/` — never each other's internals.

**Inspector auth (ADR-018):** operators are **login accounts** (a `users` row,
role `operator`, linked 1:1 to an `operators` row; matricule = username). The
inspector logs into the PWA with their own credentials; the server attributes
the part to *their* linked operator (`POST /inspections` ignores a body
`operator_id` for operator callers — no spoofing). The old station+PIN flow and
`POST /operators/verify-pin` are **retired**. A `station` JWT still exists for
the andon board / tooling (POST with an explicit `operator_id`).

## Layout

```
dashboard/
├── src/
│   ├── main.tsx
│   ├── App.tsx              # Router + providers ONLY, no business logic
│   ├── config.ts            # Runtime config from injected env (single source)
│   ├── api/                 # API client layer — one file per resource
│   │   ├── client.ts        # axios instance, interceptors
│   │   ├── defects.ts
│   │   ├── operators.ts
│   │   ├── logs.ts
│   │   └── stats.ts
│   ├── hooks/               # React-Query hooks wrapping api/, one file per resource
│   ├── features/            # Feature-sliced: each feature owns its UI + state
│   │   ├── products/        # Product list (top-level config entity)
│   │   │   ├── ProductsPage.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   ├── ProductForm.tsx
│   │   │   └── index.ts
│   │   ├── product-detail/  # One product: defect types in both categories
│   │   │   ├── ProductDetailPage.tsx
│   │   │   ├── DefectTypeCard.tsx
│   │   │   ├── DefectTypeForm.tsx
│   │   │   └── index.ts
│   │   ├── operators/
│   │   ├── logs/
│   │   ├── analytics/
│   │   └── devices/
│   ├── components/
│   │   ├── ui/              # shadcn/ui generated, do not edit by hand
│   │   └── shared/          # Cross-feature components (DateRangePicker, etc.)
│   ├── lib/
│   │   ├── feature-flags.ts # Client-side flag access
│   │   ├── format.ts        # date/number formatters
│   │   └── schemas/         # Zod schemas, mirror api/ structure
│   └── types/               # Shared TS types matching server schemas
├── public/
├── Dockerfile               # Multi-stage: node builder → caddy runtime
├── vite.config.ts
└── CLAUDE.md
```

## Modularity rules — feature-sliced architecture

The dashboard is organized by **feature**, not by technical layer. Each
folder under `features/` is a self-contained vertical slice:

- All UI for that feature
- Local state (if any)
- Feature-specific hooks
- A single `index.ts` exporting the public surface (usually just the page)

Rules:
- A feature MAY import from `api/`, `hooks/`, `components/`, `lib/`, `types/`.
- A feature MUST NOT import from another feature's internals. If two features
  need the same piece, lift it into `components/shared/` or `lib/`.
- Adding a feature = adding a folder + adding a route. Removing = deleting
  the folder + removing the route. No other code touched.

## API client layer

- `api/client.ts` is the only place axios is configured
- Each resource file exports typed functions returning Promises (no React there)
- Hooks in `hooks/` wrap those functions in `useQuery`/`useMutation`
- Components never call axios directly. They use hooks.

## Configuration

A web app runs in the browser, so "env vars" mean two things:

1. **Build-time** (Vite `VITE_*` vars): baked into the JS bundle at build.
   Use for things that never change per deployment (e.g., feature toggles
   for the build).
2. **Runtime** (injected by Caddy at request time via a template, or fetched
   from `/api/config` endpoint on app boot): use for anything that differs
   per environment (API base URL, plant name, etc.).

Pattern: `src/config.ts` reads from `window.__APP_CONFIG__`, populated by an
inline `<script>` Caddy generates at request time. This means one built image
deploys to dev, staging, and prod with no rebuild.

## Feature flags

- Server exposes `/api/feature-flags` returning the current map
- Dashboard fetches on app boot, caches in TanStack Query with 5 min staleness
- `useFlag("flag_name")` hook in `lib/feature-flags.ts` returns bool
- Use to hide unfinished UI from production or A/B test new flows

## Data model notes (ADR-013)

Products are the top-level configuration entity. Defect types only exist
inside a product context — there is no global defect-type list. The two
categories (`PMP`, `INJECTION`) are plant-wide constants; their display
names (`"PMP Défauts"`, `"Injection Défauts"`) are fetched from
`GET /constants/categories` and must never be hardcoded in component
source. New pages needed (not yet built):

- `ProductsPage` — list all products, create/archive
- `ProductDetailPage` — manage one product's defect types in both
  categories, showing the 12-cap counter per category

The `defect-types/` feature folder is replaced by `products/` and
`product-detail/`. There is no standalone defect-types page.

## UI rules

- Defect type editor must show the 12-per-category cap as a visible
  counter per `(product, category)` and disable "Add" at 12.
  The `is_other_fallback` type does not count toward the cap and must
  be rendered as undeletable (no delete button or button is greyed out).
- Category labels come from `GET /constants/categories` via a hook —
  never hardcode `"PMP Défauts"` or `"Injection Défauts"` in JSX.
- After a defect mutation, show a "syncing to devices" indicator that
  resolves when the server confirms the MQTT publish (server returns
  config version, device status endpoint shows which devices have that
  version)
- Default filter on Logs page = last 7 days
- Devices page polls every 10s for live online/offline status
- All forms use `react-hook-form` + `zodResolver`. Schemas in `lib/schemas/`
- Server state in TanStack Query, NOT in component state or Redux
- Toasts (sonner) for mutation feedback. No `alert()` ever

## Containerization

Multi-stage Dockerfile:
- `builder`: node:20-alpine, runs `pnpm install` then `pnpm build`
- `runtime`: `caddy:2-alpine`, copies `/dist` from builder, custom Caddyfile

Runtime Caddy:
- Serves SPA with fallback to `/index.html`
- Reverse-proxies `/api/*` to the server container by service name (no
  hardcoded IP)
- Injects runtime config into a `/config.js` endpoint from env vars
- Listens on 80 (TLS terminated by the upstream Caddy in `infra/`)

Must build for `linux/arm64`.

## Testing

- Vitest + React Testing Library
- One test per page rendering happy path. Don't chase coverage on UI.
- Mock the API client at the axios level using MSW
- Each feature's tests live next to its code in `features/<name>/__tests__/`

## Environment Variables (runtime)

- `API_BASE_URL` (injected into `window.__APP_CONFIG__`)
- `PLANT_NAME` (display string, e.g. "Tunis Plant 1")
- `LOCALE` (e.g. "fr-TN")
- `FEATURE_FLAG_OVERRIDES` (optional, JSON object for dev)
