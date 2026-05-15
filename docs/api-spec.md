# API Specification

FastAPI server running inside Docker on the RPi. All endpoints are v1
(implicit). A v2 would live at `/api/v2/...`, not as an in-place change.
See `docs/data-model.md` for underlying schemas.

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

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/login` | — | Get JWT |
| GET | `/auth/me` | ✓ | Current user info |
| GET | `/operators` | ✓ | List active operators |
| POST | `/operators` | ✓ | Create operator |
| GET | `/operators/{id}` | ✓ | Get operator |
| PATCH | `/operators/{id}` | ✓ | Update operator |
| DELETE | `/operators/{id}` | ✓ | Soft-delete operator |
| POST | `/operators/{id}/pin` | ✓ | Set operator PIN |
| GET | `/categories` | ✓ | List active categories |
| POST | `/categories` | ✓ | Create category |
| PATCH | `/categories/{id}` | ✓ | Update category |
| DELETE | `/categories/{id}` | ✓ | Soft-delete category |
| GET | `/categories/{id}/types` | ✓ | List defect types in category |
| POST | `/categories/{id}/types` | ✓ | Create defect type |
| PATCH | `/types/{id}` | ✓ | Update defect type |
| DELETE | `/types/{id}` | ✓ | Soft-delete defect type |
| GET | `/devices` | ✓ | List known devices |
| GET | `/devices/{id}` | ✓ | Get device detail |
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

### `GET /operators`

Returns active operators only. Add `?include_archived=true` for all.

```json
// Response 200
[
  { "id": 1, "name": "Mohammed", "active": true, "created_at": "2024-01-10T09:00:00Z" }
]
```

### `POST /operators`

```json
// Request
{ "name": "Aïcha" }

// Response 201
{ "id": 2, "name": "Aïcha", "active": true, "created_at": "2024-01-10T09:05:00Z" }
```

### `PATCH /operators/{id}`

```json
// Request (partial — only provided fields updated)
{ "name": "Aïcha B." }

// Response 200 — updated operator object
```

### `DELETE /operators/{id}`

Soft-delete: sets `active=false` and `archived_at`. Returns 204.
Fails with 409 if the operator has defect logs (referenced by logs).
Actually: never hard-fail — the operator is soft-deleted and remains
readable in log history.

### `POST /operators/{id}/pin`

```json
// Request
{ "pin": "1234" }

// Response 204
```

PIN is hashed server-side. The raw PIN is never stored.
After this call, a new `qc/config/operators` MQTT message is published
with updated hashes. See `docs/mqtt-topics.md`.

---

## Defect Categories

### `GET /categories`

```json
// Response 200
[
  {
    "id": 1, "name": "Surface Defects", "display_order": 0,
    "active": true, "defect_count": 8
  }
]
```

### `POST /categories`

```json
// Request
{ "name": "Assembly Defects", "display_order": 1 }

// Response 201
{ "id": 2, "name": "Assembly Defects", "display_order": 1, "active": true, ... }
```

### `PATCH /categories/{id}`

```json
// Request
{ "name": "Paint Defects", "display_order": 0 }
```

### `DELETE /categories/{id}`

Soft-delete. Also soft-deletes all `defect_types` in this category.
Returns 204. Triggers `qc/config/defects` MQTT publish.

---

## Defect Types

### `GET /categories/{id}/types`

```json
// Response 200
[
  { "id": 1, "category_id": 1, "label": "Scratch", "display_order": 0, "active": true }
]
```

### `POST /categories/{id}/types`

```json
// Request
{ "label": "Scratch", "display_order": 0 }

// Response 201
{ "id": 1, "category_id": 1, "label": "Scratch", "display_order": 0, "active": true }

// Response 409 — if category already has 12 active types
{ "detail": "Category has reached the 12-defect limit." }
```

After a successful create or update, the server publishes a new
`qc/config/defects` retained MQTT message. See `docs/mqtt-topics.md`.

### `PATCH /types/{id}`

```json
// Request
{ "label": "Deep Scratch", "display_order": 0 }
```

Moving a defect type to a different category is not supported. Archive
and recreate instead.

### `DELETE /types/{id}`

Soft-delete. Returns 204. Triggers `qc/config/defects` MQTT publish.

---

## Devices

Read-only. Devices are auto-registered on first heartbeat.

### `GET /devices`

```json
// Response 200
[
  {
    "id": "qc-stm32-001a2b3c",
    "last_seen": "2024-01-15T08:23:00Z",
    "online": true,
    "config_version": 1,
    "operator_version": 1,
    "first_seen": "2024-01-10T07:00:00Z"
  }
]
```

`online` is `true` if `last_seen` is within the last 90 seconds.

### `GET /devices/{id}`

Same shape as list item. Returns 404 if device is unknown.

---

## Defect Logs

### `GET /logs`

Query params: `from`, `to` (ISO 8601), `operator_id`, `defect_type_id`,
`device_id`, `page` (default 1), `per_page` (default 50, max 200).

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
      "defect_type": { "id": 2, "label": "Bubble", "category": "Surface" },
      "product_ref": "BODY-2024-0042",
      "logged_at": "2024-01-15T08:23:01Z",
      "received_at": "2024-01-15T08:23:01Z"
    }
  ]
}
```

### `GET /logs/export.csv`

Same filters as `GET /logs`. Streams a CSV file. No pagination —
returns all matching rows. Response headers:
```
Content-Type: text/csv
Content-Disposition: attachment; filename="defect-logs-<date>.csv"
```

---

## Stats

All endpoints accept a `days` query param (default 7, max 365).
All timestamps in response are UTC.

### `GET /stats/summary?days=7`

```json
[
  { "date": "2024-01-15", "count": 42 },
  { "date": "2024-01-14", "count": 38 }
]
```

### `GET /stats/by-defect?days=30`

```json
[
  { "defect_type_id": 2, "label": "Bubble", "category": "Surface", "count": 120 },
  { "defect_type_id": 1, "label": "Scratch", "category": "Surface", "count": 95 }
]
```

### `GET /stats/by-operator?days=30`

```json
[
  { "operator_id": 1, "name": "Mohammed", "count": 200 },
  { "operator_id": 2, "name": "Aïcha", "count": 185 }
]
```

### `GET /stats/heatmap?days=30`

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
  "devices": [
    { "id": "qc-stm32-001a2b3c", "online": true, "last_seen": "2024-01-15T08:23:00Z" }
  ],
  "config_version": 1
}
```

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
| 409 | Business rule violation (e.g. 12-defect cap) |
| 422 | Unprocessable entity (schema mismatch) |
| 500 | Unexpected server error |
