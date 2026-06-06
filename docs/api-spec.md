# API Specification

FastAPI server running inside Docker on the RPi. All endpoints are v1
(implicit). A v2 would live at `/api/v2/...`, not as an in-place change.
See `docs/data-model.md` for underlying schemas and `docs/decisions.md`
ADR-013 for the product-scoped model decision.

---

## Base URL & Auth

```
Base:  http://<rpi-ip>:8000
Auth:  Bearer <JWT>  (Authorization header)
```

JWT issued by `POST /auth/login`. Short-lived (1 h). Refresh via
re-login for PoC — no refresh token flow.

All endpoints require a valid JWT except:
- `GET /health`
- `GET /health/detailed`
- `POST /auth/login`

---

## Quick Reference

> **ADR-017 (web pivot) — planned endpoints** powering the inspection PWA and
> the andon board. Inspection ingest is now REST; `record_part` is shared with
> the MQTT handler.
>
> | Method | Path | Auth | Purpose |
> |---|---|---|---|
> | POST | `/inspections` | operator/station/✓ | Log one part inspection (schema 4) → rows |
> | GET | `/kpi` | operator/station/✓ | KPI snapshot (Taux NC, parts, NC, defects) |
> | POST | `/operators` | ✓ | Create operator + login → **username/password once** |
> | POST | `/operators/{id}/regenerate-password` | ✓ | Rotate password, return once |
> | GET | `/reports/quality?from=&to=` | ✓ | Period quality report data (the dashboard renders + prints it) |

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/login` | — | Get JWT |
| GET | `/auth/me` | ✓ | Current user info |
| GET | `/operators` | ✓ | List operators (active by default) |
| POST | `/operators` | ✓ | Create operator + login (mint username/password once) |
| GET | `/operators/{id}` | ✓ | Get operator |
| PATCH | `/operators/{id}` | ✓ | Update operator |
| DELETE | `/operators/{id}` | ✓ | Soft-delete operator (+ disable login) |
| POST | `/operators/{id}/regenerate-password` | ✓ | Rotate password, return plaintext once |
| GET | `/products` | ✓ | List products (active by default) |
| GET | `/products/live` | ✓ | Per-product live activity today (operators, Taux NC, feed) |
| POST | `/products` | ✓ | Create product (auto-creates Other fallbacks) |
| GET | `/products/{product_id}` | ✓ | Get product |
| PATCH | `/products/{product_id}` | ✓ | Update product |
| DELETE | `/products/{product_id}` | ✓ | Soft-delete product |
| GET | `/products/{product_id}/defect-types` | ✓ | List defect types for a product |
| POST | `/products/{product_id}/defect-types` | ✓ | Create defect type |
| GET | `/defect-types/{type_id}` | ✓ | Get defect type |
| PATCH | `/defect-types/{type_id}` | ✓ | Update defect type |
| DELETE | `/defect-types/{type_id}` | ✓ | Soft-delete defect type |
| GET | `/constants/categories` | ✓ | Plant-wide category display names |
| GET | `/devices` | ✓ | List known devices |
| GET | `/devices/live` | ✓ | Per-station live activity today (Stations en direct) |
| GET | `/devices/{device_id}` | ✓ | Get device detail |
| GET | `/events` | ✓ | SSE stream — emits `inspection` on each new part |
| GET | `/logs` | ✓ | List defect logs (filtered) |
| GET | `/logs/export.csv` | ✓ | Export logs as CSV |
| GET | `/stats/summary` | ✓ | Daily defect counts |
| GET | `/stats/by-defect` | ✓ | Counts grouped by defect type |
| GET | `/stats/by-operator` | ✓ | Counts grouped by operator |
| GET | `/stats/heatmap` | ✓ | Hour-of-day × defect heatmap |
| GET | `/kpi` | operator, station, admin | One-day KPI snapshot (taux NC, parts) |
| GET | `/reports/quality?from=&to=` | ✓ | Period quality report (by product, operator leaderboard, daily) |
| GET | `/flags` | ✓ | List live feature flags |
| PUT | `/flags/{name}` | ✓ | Toggle a live feature flag |
| GET | `/health` | — | Liveness check |
| GET | `/health/detailed` | — | Full system status |

---

## Auth

### `POST /auth/login`

```json
// Request
{ "email": "qc@plant.local", "password": "s3cr3t" }

// Response 200
{ "access_token": "<JWT>", "token_type": "bearer" }
```

```bash
curl -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"qc@plant.local","password":"s3cr3t"}'
```

### `GET /auth/me`

```json
// Response 200 (admin)
{ "id": 1, "email": "qc@plant.local", "role": "admin", "operator_id": null }

// Response 200 (operator) — operator_id links to the operators row
{ "id": 7, "email": "aicha", "role": "operator", "operator_id": 2 }
```

---

## Operators (ADR-018)

An operator **is a login account** (role `operator`) linked 1:1 to an
`operators` row for attribution. On create, the responsable supplies the
operator's **matricule** (employee id), which **is** the login username; the
server mints a **password**, returned in plaintext **once** — the responsable
relays it to the operator. Only the password hash is stored; it cannot be
retrieved afterwards, only regenerated. The operator then signs in on the
unified login page (matricule + password) and is routed to the inspection PWA.
Matricules are unique (duplicate → 409) and must match `^[A-Za-z0-9._-]+$`.

### `GET /operators`

Returns active operators only by default. Add `?include_archived=true`
to include archived operators.

```json
// Response 200
[
  {
    "id": 1,
    "matricule": "EMP-0427",
    "name": "Mohammed",
    "last_name": "Benali",
    "phone": "55123456",
    "address": null,
    "username": "EMP-0427",
    "has_login": true,
    "pin_set": false,
    "active": true,
    "created_at": "2026-05-19T09:00:00Z",
    "archived_at": null
  }
]
```

`username` equals the `matricule`. `has_login` is `true` when the operator has a
linked login account; `password` is never returned on reads.

### `POST /operators`

Creates an operator **and** its login user (username = `matricule`), returning
the plaintext `password` **once** — show it to the operator immediately.
Password length is set by `OPERATOR_PASSWORD_LENGTH` (default 8). A duplicate
matricule returns **409**.

```json
// Request — matricule + name required; last_name/phone/address optional
{ "matricule": "EMP-0428", "name": "Aïcha", "last_name": "Khelifi", "phone": "55200300" }

// Response 201
{
  "id": 2,
  "matricule": "EMP-0428",
  "name": "Aïcha",
  "last_name": "Khelifi",
  "phone": "55200300",
  "address": null,
  "username": "EMP-0428",
  "has_login": true,
  "pin_set": false,
  "active": true,
  "created_at": "2026-05-19T09:05:00Z",
  "archived_at": null,
  "password": "kf7mq2pa"
}
```

### `POST /operators/{id}/regenerate-password`

Rotates the operator's login password and returns the new `password` **once**
(same shape as `POST /operators`). The old password stops working immediately.
Back-fills a login account for legacy operators that predate ADR-018.

### `PATCH /operators/{id}`

Updates `name`, `last_name`, `phone`, `address` (matricule is immutable).

```json
// Request (partial — only provided fields updated)
{ "name": "Aïcha B.", "phone": "55200301" }

// Response 200 — updated operator object
```

### `DELETE /operators/{id}`

Soft-delete: sets `active=false` and `archived_at`, and **deactivates the
linked login** (the operator can no longer sign in). Returns 204. The operator
remains readable in log history.

---

## Products

Products are the top-level configuration entity. A product groups its
defect types into the two plant-wide categories (`PMP`, `INJECTION`).
Creating a product auto-creates the two "Other" fallback defect types
(one per category). A product with only fallback types is valid (useful
during setup); the STM32 omits such products from the published config.

See ADR-013 and `docs/data-model.md` → products for full schema.

### `GET /products`

Query params: `include_archived` (default `false`).

```json
// Response 200
[
  {
    "id": 1,
    "name": "Capot moteur",
    "reference": "PROD-001",
    "client": "Renault",
    "cheatsheet": null,
    "active": true,
    "created_at": "2026-05-19T09:00:00Z"
  }
]
```

`reference`, `client`, `cheatsheet` are the optional product "fiche" (ADR-019).

### `POST /products`

```json
// Request — only name is required; reference/client/cheatsheet optional
{ "name": "Capot moteur", "reference": "PROD-001", "client": "Renault", "cheatsheet": "Vérifier les coulures sur l'arête." }

// Response 201
{
  "id": 1,
  "name": "Capot moteur",
  "reference": "PROD-001",
  "client": "Renault",
  "cheatsheet": "Vérifier les coulures sur l'arête.",
  "active": true,
  "created_at": "2026-05-19T09:00:00Z"
}
```

Side effect: auto-creates two `defect_types` rows with
`is_other_fallback=true`, one for `"PMP"` and one for `"INJECTION"`.
Publishes a new `qc/config/products` MQTT message.

### `GET /products/{product_id}`

Same shape as list item. Returns 404 if product is unknown.

### `PATCH /products/{product_id}`

```json
// Request (partial — only provided fields updated)
{ "name": "Capot moteur v2", "client": "Renault Tanger", "cheatsheet": "..." }

// Response 200 — updated product object
```

### `DELETE /products/{product_id}`

Soft-delete: sets `active=false` and `archived_at`. Returns 204.
Cascades to all `defect_types` for this product (also soft-deleted).
Triggers `qc/config/products` MQTT publish.

### `GET /products/live`

Per-product live activity for the current plant-local day (ADR-019), backing
the "Produits en direct" page. Only products inspected today appear; active
products (recent activity) sort first, then the busiest. All counts are
per part.

```json
// Response 200
{
  "updated_at": "2026-06-06T10:00:00Z",
  "products": [
    {
      "product_id": 1,
      "product_name": "Capot moteur",
      "reference": "PROD-001",
      "client": "Renault",
      "active": true,
      "last_activity": "2026-06-06T09:58:00Z",
      "parts_today": 17, "nc_parts": 4, "ok_parts": 13, "defect_count": 5,
      "nc_rate": 0.2353, "last_hour_parts": 6, "active_operators": 2,
      "operators": [
        { "operator_id": 1, "operator_name": "Mohammed", "parts": 10,
          "nc_parts": 3, "nc_rate": 0.3, "last_at": "2026-06-06T09:58:00Z",
          "active": true }
      ],
      "feed": [
        { "id": 201, "label": "Coulure", "category": "PMP Défauts",
          "note": null, "operator_name": "Mohammed",
          "logged_at": "2026-06-06T09:58:00Z", "is_other": false }
      ]
    }
  ]
}
```

---

## Defect Types

Defect types are always accessed in the context of their product.
The `is_other_fallback` type is auto-managed and cannot be archived
from the UI.

**Cap rule:** max 12 active, non-fallback defect types per
`(product_id, category_kind)`. The `is_other_fallback` type does not
count toward the cap. Violation → HTTP 409.

**Other fallback:** exactly one `is_other_fallback=true` defect type
per `(product_id, category_kind)`. Label fixed at `"Autre — préciser"`.
Auto-created by `POST /products`. `DELETE` on a fallback type
returns 409.

### `GET /products/{product_id}/defect-types`

Query params:
- `category_kind` — filter by `"PMP"` or `"INJECTION"` (optional)
- `include_archived` — default `false`

```json
// GET /products/1/defect-types?category_kind=PMP
// Response 200
[
  {
    "id": 5,
    "product_id": 1,
    "category_kind": "PMP",
    "label": "Coulure",
    "is_other_fallback": false,
    "display_order": 0,
    "active": true,
    "created_at": "2026-05-19T09:00:00Z"
  },
  {
    "id": 7,
    "product_id": 1,
    "category_kind": "PMP",
    "label": "Autre — préciser",
    "is_other_fallback": true,
    "display_order": 99,
    "active": true,
    "created_at": "2026-05-19T09:00:00Z"
  }
]
```

### `POST /products/{product_id}/defect-types`

```json
// Request
{ "category_kind": "PMP", "label": "Coulure", "display_order": 0 }

// Response 201
{
  "id": 5,
  "product_id": 1,
  "category_kind": "PMP",
  "label": "Coulure",
  "is_other_fallback": false,
  "display_order": 0,
  "active": true,
  "created_at": "2026-05-19T09:00:00Z"
}

// Response 409 — cap exceeded
{ "detail": "Category PMP already has 12 active defect types for this product" }
```

After a successful create, the server publishes a new
`qc/config/products` retained MQTT message. See `docs/mqtt-topics.md`.

### `GET /defect-types/{type_id}`

```json
// Response 200 — same shape as list item above
```

### `PATCH /defect-types/{type_id}`

```json
// Request (partial)
{ "label": "Coulure longue", "display_order": 1 }

// Response 200 — updated defect type object
```

Cannot update `product_id`, `category_kind`, or `is_other_fallback`.
To move a defect type to a different product or category, archive and
recreate.

### `DELETE /defect-types/{type_id}`

Soft-delete. Returns 204. Triggers `qc/config/products` MQTT publish.
Returns 409 if the type has `is_other_fallback=true`.

---

## Constants

### `GET /constants/categories`

Returns the plant-wide category list with display names. The dashboard
uses this to render category labels rather than hardcoding them.
Values come from `app/constants.py`, not the database.

```json
// Response 200
[
  { "kind": "PMP",       "display_name": "PMP Défauts" },
  { "kind": "INJECTION", "display_name": "Injection Défauts" }
]
```

---

## Devices

Read-only. Devices are auto-registered on first heartbeat.

### `GET /devices`

```json
// Response 200
[
  {
    "id": "qc-stm32-001a2b3c",
    "last_seen": "2026-05-19T08:23:00Z",
    "online": true,
    "config_version": 2,
    "operator_version": 1,
    "active": true,
    "first_seen": "2026-05-19T07:00:00Z"
  }
]
```

`online` is `true` if `last_seen` is within the last 90 seconds (3
missed 30-second heartbeats from the STM32 firmware).
`config_version` corresponds to the `schema_version` of the last
`qc/config/products` message the device acknowledged.

### `GET /devices/{device_id}`

Same shape as list item. Returns 404 if device is unknown.

---

## Defect Logs

### `GET /logs`

Query params: `from`, `to` (ISO 8601), `operator_id`, `defect_type_id`,
`device_id`, `product_id`, `page` (default 1), `per_page`
(default 50, max 200).

```json
// Response 200
{
  "total": 1042,
  "page": 1,
  "per_page": 50,
  "items": [
    {
      "id": 101,
      "device_id": "qc-stm32-001a2b3c",
      "operator": { "id": 1, "name": "Mohammed" },
      "product": { "id": 1, "name": "Capot moteur", "reference": "PROD-001" },
      "defect_type": {
        "id": 5,
        "label": "Coulure",
        "category_kind": "PMP",
        "is_other_fallback": false
      },
      "note": null,
      "logged_at": "2026-05-19T08:23:01Z",
      "received_at": "2026-05-19T08:23:01Z"
    }
  ]
}
```

`note` is non-null only for logs where `defect_type.is_other_fallback`
is `true`. Use `product_id` to filter logs to a single product.

### `GET /logs/export.csv`

Same filters as `GET /logs`. Streams a CSV file. No pagination —
returns all matching rows. Response headers:
```
Content-Type: text/csv
Content-Disposition: attachment; filename="defect-logs-<date>.csv"
```

---

## Stats

All endpoints accept a `days` query param (default 7, max 365) and an
optional `product_id` query param for per-product filtering.
Omit `product_id` to aggregate across all products.
All timestamps in response are UTC.

### `GET /stats/summary?days=7&product_id=1`

```json
[
  { "date": "2026-05-19", "count": 42 },
  { "date": "2026-05-18", "count": 38 }
]
```

### `GET /stats/by-defect?days=30&product_id=1`

```json
[
  {
    "defect_type_id": 5,
    "label": "Coulure",
    "category_kind": "PMP",
    "product": { "id": 1, "name": "Capot moteur" },
    "count": 120
  },
  {
    "defect_type_id": 6,
    "label": "Bullage",
    "category_kind": "PMP",
    "product": { "id": 1, "name": "Capot moteur" },
    "count": 95
  }
]
```

### `GET /stats/by-operator?days=30&product_id=1`

```json
[
  { "operator_id": 1, "name": "Mohammed", "count": 200 },
  { "operator_id": 2, "name": "Aïcha",    "count": 185 }
]
```

### `GET /stats/heatmap?days=30&product_id=1`

Hour-of-day (0–23) × defect count. Useful for spotting shift patterns.

```json
[
  { "hour": 8,  "count": 45 },
  { "hour": 9,  "count": 62 },
  { "hour": 14, "count": 58 }
]
```

---

## KPI

### `GET /kpi?date=YYYY-MM-DD&product_id=1`

Single-day quality snapshot for the andon board and the dashboard hero tiles.
`date` is plant-local (defaults to today); `product_id` is optional. Auth:
`operator`, `station`, or `admin`.

Everything is counted **per part** (one full inspection, grouped by
`part_inspection_id`): a part with three defects is one inspected part and one
NC part. `taux NC` = `nc_parts / inspected_parts`.

```json
// Response 200
{
  "date": "2026-06-04",
  "inspected_parts": 3,
  "nc_parts": 2,
  "ok_parts": 1,
  "nc_rate": 0.6667,
  "defect_count": 3,
  "last_hour_parts": 3,
  "updated_at": "2026-06-04T13:20:00Z"
}
```

An unparseable `date` returns `400`.

---

## Reports

### `GET /reports/quality?from=YYYY-MM-DD&to=YYYY-MM-DD`

Aggregated quality metrics for a plant-local date range (defaults to the last
30 days), for the printable dashboard report. Admin only. Pure data — the
dashboard renders and prints it. Everything is per part. Adds, over the KPI
snapshot, a per-product breakdown and an operator leaderboard ranked by
**productivity** (parts inspected — ADR-019).

```json
// Response 200 (abridged)
{
  "date_from": "2026-05-08", "date_to": "2026-06-06",
  "generated_at": "2026-06-06T10:00:00Z",
  "inspected_parts": 420, "nc_parts": 51, "ok_parts": 369, "nc_rate": 0.1214,
  "pmp_nc_parts": 30, "pmp_nc_rate": 0.0714,
  "inj_nc_parts": 25, "inj_nc_rate": 0.0595,
  "defects_total": 73,
  "top_defects": [ { "label": "Coulure", "count": 22 } ],
  "by_operator": [
    { "operator": "Mohammed", "matricule": "EMP-0427", "rank": 1,
      "parts": 230, "nc_parts": 28, "nc_rate": 0.1217 }
  ],
  "by_product": [
    { "product": "Capot moteur", "reference": "PROD-001", "parts": 260,
      "nc_parts": 33, "nc_rate": 0.1269, "pmp_nc_parts": 20, "inj_nc_parts": 15 }
  ],
  "daily": [ { "date": "2026-06-06", "parts": 17, "nc_parts": 4, "nc_rate": 0.2353 } ]
}
```

`by_operator` is sorted by `parts` desc (best productivity = `rank` 1). An
invalid `from`/`to`, or `from > to`, returns `400`.

---

## Feature Flags

### `GET /flags`

```json
[
  { "name": "new_analytics_view", "enabled": false, "description": "..." }
]
```

### `PUT /flags/{name}`

```json
// Request
{ "enabled": true }

// Response 200 — updated flag object
```

See `docs/feature-flags.md` for the flag registry.

---

## Health

### `GET /health`

Liveness only. Returns 200 if the process is alive.
```json
{ "status": "ok" }
```

### `GET /health/detailed`

```json
{
  "status": "ok",
  "db": "ok",
  "mqtt_broker": "ok",
  "config_version": 2,
  "devices": [
    {
      "id": "qc-stm32-001a2b3c",
      "online": true,
      "last_seen": "2026-05-19T08:23:00Z",
      "config_version": 2
    }
  ]
}
```

`status` is `"ok"` when both `db` and `mqtt_broker` are `"ok"`;
`"degraded"` otherwise. This endpoint itself always returns HTTP 200 —
it reports component health, not its own health.

---

## Error Format

All errors follow:
```json
{ "detail": "Human-readable message." }
```

| Code | Meaning |
|---|---|
| 400 | Validation error (Pydantic) |
| 401 | Missing or invalid JWT |
| 404 | Resource not found |
| 409 | Business rule violation (cap exceeded, archiving a fallback type) |
| 422 | Unprocessable entity (schema mismatch) |
| 500 | Unexpected server error |
