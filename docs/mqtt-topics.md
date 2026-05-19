# MQTT Topics

Mosquitto broker on the RPi, port 1883 (cleartext for PoC).
See `docs/decisions.md` ADR-002 for why MQTT instead of HTTP for device
comms, ADR-003 for the retained-message pattern, and ADR-013 for the
product-scoped payload schema introduced in `qc/config/products`.

---

## Broker

| Setting | Value |
|---|---|
| Host | RPi static IP (env var `MQTT_HOST`) |
| Port | 1883 |
| Auth | Username + password per client (see Access Control) |
| TLS | Disabled for PoC (`APP_FEATURE_MQTT_TLS=0`). Enable for production. |
| Persistence | Enabled — retained messages survive broker restart |

---

## Topic Table

| Topic | Direction | QoS | Retained | Publisher | Subscribers |
|---|---|---|---|---|---|
| `qc/config/products` | server → device | 1 | yes | server | all STM32 |
| `qc/config/operators` | server → device | 1 | yes | server | all STM32 |
| `qc/device/{id}/cmd` | server → device | 1 | no | server | one STM32 |
| `qc/device/{id}/status` | device → server | 0 | no | one STM32 | server |
| `qc/device/{id}/session` | device → server | 1 | no | one STM32 | server |
| `qc/device/{id}/defect` | device → server | 1 | no | one STM32 | server |

`{id}` is the STM32 hardware UID, lowercase hex, e.g. `qc-stm32-001a2b3c`.
See `docs/data-model.md` → `devices` table for how IDs are formed.

---

## `qc/config/products`

**Direction:** server → all devices  
**QoS:** 1 | **Retained:** yes

Published by the server after any change to `products` or `defect_types`.
Contains only active products that have at least one non-fallback defect
type, sorted by product `id`. Firmware persists this to Octo-SPI and
rebinds the product-selection and defect-grid screens.

New subscribers receive the retained message immediately on connect —
this is how a cold-booted STM32 gets its config before any dashboard
interaction.

```json
{
  "schema_version": 2,
  "products": [
    {
      "id": 1,
      "name": "Capot moteur",
      "reference": "PROD-001",
      "categories": {
        "PMP": {
          "display_name": "PMP Défauts",
          "defect_types": [
            { "id": 5, "label": "Coulure",         "is_other": false, "display_order": 0 },
            { "id": 6, "label": "Bullage",          "is_other": false, "display_order": 1 },
            { "id": 7, "label": "Autre — préciser", "is_other": true,  "display_order": 99 }
          ]
        },
        "INJECTION": {
          "display_name": "Injection Défauts",
          "defect_types": [
            { "id": 8, "label": "Crique",           "is_other": false, "display_order": 0 },
            { "id": 9, "label": "Autre — préciser", "is_other": true,  "display_order": 99 }
          ]
        }
      }
    }
  ]
}
```

**Field constraints (validated by both server and firmware):**
- `products`: 0–N entries (firmware has `APP_PRODUCT_LIST_MAX` —
  see `docs/build-flags.md`)
- `defect_types` per category: 0–13 (0–12 user-defined + 1 fallback)
- `label`: 1–24 characters, UTF-8
- `schema_version`: integer; reject if > current supported version

**Schema version:** 2. Bumped from the old `qc/config/defects`
schema_version 1 due to restructuring the payload around products.

---

## `qc/config/operators`

**Direction:** server → all devices  
**QoS:** 1 | **Retained:** yes

Published after any `operators` table change (create, update, pin change,
soft-delete). Only active operators are included. The firmware compares
the entered PIN against `pin_hash` at login.

```json
{
  "schema_version": 1,
  "operators": [
    {
      "id": 1,
      "name": "Mohammed",
      "pin_hash": "sha256:a3f1c2b4:8b4e9d2f1a3c..."
    },
    {
      "id": 2,
      "name": "Aïcha",
      "pin_hash": "sha256:9d2e4f1a:3c7b8e2f..."
    }
  ]
}
```

**`pin_hash` format:** `<algorithm>:<hex_salt>:<hex_hash>`  
For PoC: `sha256` (faster on MCU). If `APP_FEATURE_ARGON2_PIN=1`:
argon2 encoded string (`$argon2id$v=19$...`).  
See `docs/build-flags.md` → `APP_FEATURE_ARGON2_PIN`.

**Important:** This payload contains PIN hashes. Mosquitto ACLs ensure
only authenticated devices can subscribe. Never log this topic's payload
in full on the server.

---

## `qc/device/{id}/cmd`

**Direction:** server → one device  
**QoS:** 1 | **Retained:** no

Out-of-band commands sent to a specific device. Used for maintenance
and debugging. The STM32 subscribes to its own `cmd` topic.

```json
{
  "schema_version": 1,
  "cmd": "reboot",
  "params": {}
}
```

**Supported commands:**

| `cmd` | `params` | Effect |
|---|---|---|
| `reboot` | `{}` | Firmware triggers system reset |
| `reload_config` | `{}` | Re-read config from Octo-SPI, rebind UI |
| `reload_operators` | `{}` | Re-read operator list from Octo-SPI |
| `set_log_level` | `{"level": 3}` | Change `APP_LOG_LEVEL` at runtime |

The firmware validates `schema_version` before acting on any command.
Unknown `cmd` values are logged and discarded.

---

## `qc/device/{id}/status`

**Direction:** device → server  
**QoS:** 0 | **Retained:** no

Heartbeat published every 30 s (`APP_MQTT_STATUS_PERIOD_MS`). The server
upserts the `devices` row on receipt. A device is "online" if
`last_seen` is within the last 90 s. See `docs/api-spec.md` → `/devices`.

```json
{
  "schema_version": 1,
  "device_id": "qc-stm32-001a2b3c",
  "uptime_ms": 3612000,
  "config_version": 2,
  "operator_version": 1,
  "queue_depth": 0,
  "wifi_rssi": -52,
  "mqtt_reconnects": 1
}
```

**Field notes:**
- `config_version` — the `schema_version` of the last accepted
  `qc/config/products` message (2 after the ADR-013 migration).
- `queue_depth` — entries waiting in the offline defect queue (max 1000,
  see `docs/build-flags.md` → `APP_DEFECT_QUEUE_DEPTH`)
- `wifi_rssi` — dBm, from ISM43340 module. Useful for plant-floor
  signal-strength diagnostics. `0` if not available.
- `mqtt_reconnects` — count since last reboot; high values indicate
  Wi-Fi or broker instability

QoS 0 is intentional: status messages are ephemeral. A dropped heartbeat
is acceptable; only a sustained gap matters.

---

## `qc/device/{id}/session`

**Direction:** device → server  
**QoS:** 1 | **Retained:** no

Published when an operator completes login + product selection. Signals
the start of an inspection session on this device.

```json
{
  "schema_version": 1,
  "device_id": "qc-stm32-001a2b3c",
  "operator_id": 1,
  "product_id": 1,
  "started_at": "2026-05-19T08:14:00Z"
}
```

**Field notes:**
- `product_id` — the product the operator selected. All subsequent
  `defect` messages in this session carry the same `product_id`.
- `started_at` — STM32 RTC time (UTC) when the operator confirmed
  product selection.

A new session message is published each time the operator logs in again
(shift change, different product selection). QoS 1 ensures the server
knows which product the device is inspecting even across reconnects.

---

## `qc/device/{id}/defect`

**Direction:** device → server  
**QoS:** 1 | **Retained:** no

Published when the operator taps a defect button. QoS 1 guarantees
at-least-once delivery. If offline, the firmware queues the entry to
Octo-SPI and drains on reconnect (see `docs/build-flags.md` →
`APP_FEATURE_OFFLINE_QUEUE`).

The server MQTT bridge writes a `defect_logs` row on receipt. Duplicate
detection is not implemented for PoC (duplicate delivery is accepted as
a known limitation).

```json
{
  "schema_version": 2,
  "device_id": "qc-stm32-001a2b3c",
  "operator_id": 1,
  "product_id": 1,
  "defect_type_id": 5,
  "note": null,
  "logged_at": "2026-05-19T08:23:01Z"
}
```

**Field notes:**
- `product_id` — the product selected at session start. The server
  validates that `defect_type_id` belongs to this product.
- `note` — free-text annotation, max 200 chars. Non-null only when
  the selected defect type has `is_other_fallback=true`. The STM32
  prompts for this before publishing.
- `logged_at` — STM32 RTC time (UTC). Synced via SNTP on connect.
  If SNTP has never succeeded, firmware uses `0` and the server records
  `received_at` as a fallback.
- `schema_version` bumped to 2 (old schema_version 1 carried a
  free-text `product_ref` field instead of `product_id`, and had no
  `note` field).

---

## Schema Versioning

- Every payload includes `schema_version` (integer, starts at 1).
- Both server and firmware validate the version on receipt.
- **Receiver refuses messages with an unknown version** (logs the error,
  discards the message). This prevents silent data corruption when the
  format evolves.
- To evolve a schema: increment the version, update both server and
  firmware atomically (firmware OTA is manual in the PoC — coordinate
  releases). Old version stays supported for one full release cycle.
- The `schema_version` in a retained message reflects the *current*
  schema. If the server is rolled back, re-publish retained messages.

---

## Access Control (Mosquitto ACL)

Two account types:

**Server** (`qc-server`):
- Publishes: `qc/config/#`, `qc/device/+/cmd`
- Subscribes: `qc/device/+/status`, `qc/device/+/session`,
  `qc/device/+/defect`

**Device** (one account per device, e.g. `qc-device-001a2b3c`):
- Publishes: `qc/device/qc-stm32-001a2b3c/#`
- Subscribes: `qc/config/#`, `qc/device/qc-stm32-001a2b3c/cmd`

Device credentials are generated by `scripts/provision-device.sh` and
stored in the device's Octo-SPI provisioning sector. Never hardcoded
in source.
