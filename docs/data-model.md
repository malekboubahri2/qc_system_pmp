# Data Model

SQLite (WAL mode) on the server. Managed by SQLAlchemy 2.0 + Alembic.
See `docs/api-spec.md` for the REST surface and `docs/mqtt-topics.md`
for how this data reaches the STM32.

---

## Tables

| Table | Purpose |
|---|---|
| `operators` | Plant floor operators with PIN credentials |
| `defect_categories` | Top-level groupings shown as columns on the device |
| `defect_types` | Individual defect buttons within a category |
| `defect_logs` | Immutable log of every defect tap |
| `devices` | Known STM32 terminals (auto-registered on first heartbeat) |
| `users` | Dashboard accounts (QC responsable and admin) |
| `feature_flags` | Live-toggleable server-side flags |

---

## Hard Rules

- **No hard deletes.** Set `active = 0` and `archived_at = <UTC timestamp>`.
  The one exception is `defect_logs`: logs are append-only and immutable.
- **12 defects per category maximum.** Enforced server-side in
  `services.defect_types` before insert/update. Violation → HTTP 409.
- **Label ≤ 24 chars.** Enforced at the Pydantic schema layer. The
  firmware allocates a fixed 25-byte buffer per label.
- **UTC everywhere on the wire.** Timestamps stored as ISO 8601 strings
  (`YYYY-MM-DDTHH:MM:SSZ`). Display conversion to `Europe/Paris` is a
  dashboard concern only.

---

## operators

```sql
CREATE TABLE operators (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    pin_hash    TEXT    NOT NULL,   -- "sha256:<hex_salt>:<hex_hash>" or
                                   -- argon2 encoded string (see ADR-010)
    active      INTEGER NOT NULL DEFAULT 1,
    archived_at TEXT,              -- ISO 8601 UTC, set on soft-delete
    created_at  TEXT    NOT NULL
                DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_operators_active ON operators (active);
```

**Column notes:**
- `pin_hash` — format includes algorithm prefix so the firmware and server
  can detect which algorithm to use at verification time.
- `name` — displayed on the STM32 briefly after successful login.

**Example:**
```sql
INSERT INTO operators (name, pin_hash) VALUES
    ('Mohammed', 'sha256:a3f1c2:8b4e9d2f...');
```

---

## defect_categories

```sql
CREATE TABLE defect_categories (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,  -- controls column order on device
    active        INTEGER NOT NULL DEFAULT 1,
    archived_at   TEXT,
    created_at    TEXT    NOT NULL
                  DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_defect_categories_active ON defect_categories (active);
```

**Column notes:**
- `display_order` — lower value appears first. The device UI has two
  columns; the first two active categories fill them. Third category
  onwards is silently ignored by the firmware (max 2, enforced by UI
  design, not a DB constraint).

**Example:**
```sql
INSERT INTO defect_categories (name, display_order) VALUES
    ('Surface Defects', 0),
    ('Assembly Defects', 1);
```

---

## defect_types

```sql
CREATE TABLE defect_types (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id   INTEGER NOT NULL REFERENCES defect_categories (id),
    label         TEXT    NOT NULL,   -- max 24 chars
    display_order INTEGER NOT NULL DEFAULT 0,  -- slot position within category
    active        INTEGER NOT NULL DEFAULT 1,
    archived_at   TEXT,
    created_at    TEXT    NOT NULL
                  DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_defect_types_category ON defect_types (category_id, active);
```

**Column notes:**
- `label` — rendered verbatim on the STM32 button. Keep short: the
  button is 100×60 px. 24 chars is the hard limit, 12–16 is comfortable.
- `display_order` — slot 0–11 within the category's 4×3 grid.

**Example:**
```sql
INSERT INTO defect_types (category_id, label, display_order) VALUES
    (1, 'Scratch', 0),
    (1, 'Bubble', 1),
    (1, 'Run', 2);
```

---

## defect_logs

```sql
CREATE TABLE defect_logs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id      TEXT    NOT NULL REFERENCES devices (id),
    operator_id    INTEGER NOT NULL REFERENCES operators (id),
    defect_type_id INTEGER NOT NULL REFERENCES defect_types (id),
    product_ref    TEXT    NOT NULL,   -- free-form reference entered by operator
    logged_at      TEXT    NOT NULL,   -- device clock time (ISO 8601 UTC)
    received_at    TEXT    NOT NULL
                   DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_defect_logs_received_at  ON defect_logs (received_at);
CREATE INDEX idx_defect_logs_logged_at    ON defect_logs (logged_at);
CREATE INDEX idx_defect_logs_operator     ON defect_logs (operator_id);
CREATE INDEX idx_defect_logs_defect_type  ON defect_logs (defect_type_id);
CREATE INDEX idx_defect_logs_device       ON defect_logs (device_id);
```

**Column notes:**
- `logged_at` — set by the STM32 RTC at tap time. Can differ from
  `received_at` if the device was offline and replayed from queue.
  Use `received_at` for aggregation; use `logged_at` for timeline display.
- No `active`/`archived_at` — logs are immutable records. Never deleted.

**Example:**
```sql
INSERT INTO defect_logs
    (device_id, operator_id, defect_type_id, product_ref, logged_at)
VALUES
    ('qc-stm32-001a2b3c', 1, 2, 'BODY-2024-0042',
     '2024-01-15T08:23:01Z');
```

---

## devices

```sql
CREATE TABLE devices (
    id             TEXT    PRIMARY KEY,  -- STM32 UID, e.g. qc-stm32-001a2b3c
    last_seen      TEXT,                 -- set on every status heartbeat
    config_version INTEGER,              -- schema_version of last defect config
    operator_version INTEGER,            -- schema_version of last operator list
    active         INTEGER NOT NULL DEFAULT 1,
    archived_at    TEXT,
    first_seen     TEXT    NOT NULL
                   DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
```

**Column notes:**
- `id` — derived from the STM32's 96-bit unique ID, formatted as
  `qc-stm32-<lower8hexchars>`. Generated by the firmware; the server
  auto-inserts on first heartbeat receipt (upsert).
- A device is "online" if `last_seen` is within the last 90 seconds.

**Example:**
```sql
INSERT INTO devices (id, last_seen, config_version, operator_version)
VALUES ('qc-stm32-001a2b3c', '2024-01-15T08:23:00Z', 1, 1)
ON CONFLICT (id) DO UPDATE SET
    last_seen        = excluded.last_seen,
    config_version   = excluded.config_version,
    operator_version = excluded.operator_version;
```

---

## users

```sql
CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,   -- argon2 encoded string
    role          TEXT    NOT NULL DEFAULT 'admin',  -- only 'admin' in PoC
    active        INTEGER NOT NULL DEFAULT 1,
    archived_at   TEXT,
    created_at    TEXT    NOT NULL
                  DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_users_email ON users (email);
```

**Column notes:**
- `password_hash` — argon2id, stored as the full argon2 encoded string
  (includes algorithm, params, salt, and hash).
- `role` — reserved for future multi-role support. Only `'admin'` is
  meaningful in the PoC.

---

## feature_flags

```sql
CREATE TABLE feature_flags (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    enabled     INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    updated_at  TEXT    NOT NULL
                DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
```

**Column notes:**
- Read by `app/feature_flags.py` and cached in memory for
  `FEATURE_FLAGS_REFRESH_SECS` (default 30 s).
- See `docs/feature-flags.md` for the full flag registry.

**Example:**
```sql
INSERT INTO feature_flags (name, enabled, description) VALUES
    ('new_analytics_view', 0, 'Experimental redesigned analytics page');
```
