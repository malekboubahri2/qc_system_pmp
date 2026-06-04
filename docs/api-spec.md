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
> | POST | `/inspections` | station | Log one part inspection (schema 4) → rows |
> | POST | `/operators/verify-pin` | station | Verify `{operator_id, pin}` → 204/401 |
> | GET | `/kpi` | station/✓ | KPI snapshot (Taux NC, parts, NC, defects) |
> | POST | `/operators` | ✓ | Create operator → **mint unique PIN, return once** |
> | POST | `/operators/{id}/regenerate-pin` | ✓ | Rotate PIN, return plaintext once |
> | GET | `/reports/pdf` | ✓ | Period quality report as PDF |

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/login` | — | Get JWT |
| GET | `/auth/me` | ✓ | Current user info |
| GET | `/operators` | ✓ | List operators (active by default) |
| POST | `/operators` | ✓ | Create operator (mint unique PIN, return once) |
| GET | `/operators/{id}` | ✓ | Get operator |
| PATCH | `/operators/{id}` | ✓ | Update operator |
| DELETE | `/operators/{id}` | ✓ | Soft-delete operator |
| POST | `/operators/{id}/pin` | ✓ | Set a specific operator PIN |
| POST | `/operators/{id}/regenerate-pin` | ✓ | Rotate PIN, return plaintext once |
| POST | `/operators/verify-pin` | station, admin | Verify `{operator_id, pin}` → 204/401 |
| GET | `/products` | ✓ | List products (active by default) |
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
| GET | `/devices/{device_id}` | ✓ | Get device detail |
| GET | `/logs` | ✓ | List defect logs (filtered) |
| GET | `/logs/export.csv` | ✓ | Export logs as CSV |
| GET | `/stats/summary` | ✓ | Daily defect counts |
| GET | `/stats/by-defect` | ✓ | Counts grouped by defect type |
| GET | `/stats/by-operator` | ✓ | Counts grouped by operator |
| GET | `/stats/heatmap` | ✓ | Hour-of-day × defect heatmap |
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
// Response 200
{ "id": 1, "email": "qc@plant.local", "role": "admin" }
```

---

## Operators

Creating an operator mints a unique numeric PIN server-side and returns it
**once** — the responsable relays it to the operator. Only the hash is stored;
the raw PIN cannot be retrieved afterwards, only regenerated. Operators with a
PIN appear in the retained `qc/config/operators` message and can log in on the
PWA / STM32.

### `GET /operators`

Returns active operators only by default. Add `?include_archived=true`
to include archived operators.

```json
// Response 200
[
  {
    "id": 1,
    "name": "Mohammed",
    "pin_set": true,
    "active": true,
    "created_at": "2026-05-19T09:00:00Z",
    "archived_at": null
  }
]
```

`pin_set` is `true` if the operator has a hashed PIN stored. Only
operators with `pin_set: true` appear in the STM32 operator list.

### `POST /operators`

Creates an operator and mints a unique numeric PIN (CSPRNG, unique among
active operators). The plaintext `pin` is returned **once** in this response
and never again — show it to the operator immediately. A retained
`qc/config/operators` message is published. Length is set by
`OPERATOR_PIN_LENGTH` (default 6).

```json
// Request
{ "name": "Aïcha" }

// Response 201
{
  "id": 2,
  "name": "Aïcha",
  "pin_set": true,
  "active": true,
  "created_at": "2026-05-19T09:05:00Z",
  "archived_at": null,
  "pin": "048213"
}
```

### `POST /operators/{id}/regenerate-pin`

Rotates the operator's PIN to a fresh unique value and returns the new
plaintext `pin` **once** (same shape as `POST /operators`). The old PIN stops
working immediately; a retained `qc/config/operators` message is published.

### `POST /operators/verify-pin`

Server-side PIN check for the PWA login step (the hash never leaves the
server). Auth: `station` or `admin`.

```json
// Request
{ "operator_id": 2, "pin": "048213" }

// Response 204 on match, 401 otherwise
```

A missing operator, an archived operator, an operator with no PIN, and a wrong
PIN all return the same `401` — the endpoint does not reveal which operator
ids exist.

### `PATCH /operators/{id}`

```json
// Request (partial — only provided fields updated)
{ "name": "Aïcha B." }

// Response 200 — updated operator object
```

### `DELETE /operators/{id}`

Soft-delete: sets `active=false` and `archived_at`. Returns 204.
The operator remains readable in log history.

### `POST /operators/{id}/pin`

```json
// Request
{ "pin": "1234" }

// Response 204
```

PIN must be 4–8 numeric digits. Hashed server-side; the raw PIN is
never stored. After this call, a new `qc/config/operators` MQTT message
is published with updated hashes. See `docs/mqtt-topics.md`.

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
    "description": null,
    "active": true,
    "created_at": "2026-05-19T09:00:00Z",
    "archived_at": null
  }
]
```

### `POST /products`

```json
// Request
{ "name": "Capot moteur", "reference": "PROD-001", "description": null }

// Response 201
{
  "id": 1,
  "name": "Capot moteur",
  "reference": "PROD-001",
  "description": null,
  "active": true,
  "created_at": "2026-05-19T09:00:00Z",
  "archived_at": null
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
{ "name": "Capot moteur v2", "description": "Revised part geometry" }

// Response 200 — updated product object
```

### `DELETE /products/{product_id}`

Soft-delete: sets `active=false` and `archived_at`. Returns 204.
Cascades to all `defect_types` for this product (also soft-deleted).
Triggers `qc/config/products` MQTT publish.

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
