# Feature Flags

All toggleable behaviors across every component, organized by tier.
See `docs/principles.md` → "Feature Flags & Build Flags" for the
rationale behind the three-tier model.

Firmware compile-time macros (`APP_FEATURE_*`) are documented in detail
in `docs/build-flags.md`. They are listed here too for completeness.

---

## Tiers at a Glance

| Tier | Layer | Changes when | Cost to flip |
|---|---|---|---|
| Build-time | C macros, Dockerfile ARGs | Per firmware build | Rebuild + reflash |
| Runtime config | Env vars, `.env` file | Per deployment | Container restart |
| Live | DB table (server), MQTT push (firmware) | Any time | Seconds |

**Rule:** pick the cheapest tier that meets the need. If you're unsure,
read `docs/principles.md` § 4.

---

## Server — Runtime Config (env vars)

Read from the environment by `app/config.py` (Pydantic Settings).
Documented in `server/.env.example`.

| Variable | Default | Purpose | Remove when |
|---|---|---|---|
| `ENABLE_MQTT_TLS` | `false` | Wrap paho-mqtt connection in TLS | Never remove — promote to default `true` in production |
| `LOG_LEVEL` | `INFO` | Server log verbosity (`DEBUG`/`INFO`/`WARNING`/`ERROR`) | Permanent config |
| `LOG_FORMAT` | `json` | Log format (`json` for prod, `text` for local dev) | Permanent config |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated origins allowed for CORS | Permanent config |
| `FEATURE_FLAGS_REFRESH_SECS` | `30` | How often live flags are re-read from DB | Permanent config |
| `JWT_EXPIRY_SECONDS` | `3600` | JWT lifetime (1 h) | Permanent config |

**`ENABLE_MQTT_TLS`**  
When `true`, the MQTT bridge connects with TLS and requires the broker
to present a valid certificate. The broker certificate path must be set
in `MQTT_CA_CERT_PATH`. Not implemented for PoC; keep `false`.

---

## Server — Live Flags (DB-backed)

Stored in the `feature_flags` table. Read by `app/feature_flags.py`,
cached for `FEATURE_FLAGS_REFRESH_SECS` (default 30 s). Toggle via
`PUT /flags/{name}` (see `docs/api-spec.md`).

| Name | Default | Purpose | Remove when |
|---|---|---|---|
| `new_analytics_view` | `false` | Experimental redesigned analytics page | After A/B test concludes |

**Hygiene:** keep this table sparse. If a flag has been `true` in all
deployments for > 2 sprints, promote it to the default and remove the
flag. If it has been `false` for > 2 sprints, delete the dead code.
Audit flag count quarterly — more than ~10 flags is a smell.

---

## Firmware — Build-time Flags (APP_FEATURE_*)

Set in `firmware/Application/config/app_config.h`. Override via
CubeIDE preprocessor settings or `-D` on the compiler command line.
Full details in `docs/build-flags.md`.

| Macro | Default | Purpose | Remove when |
|---|---|---|---|
| `APP_FEATURE_MQTT_TLS` | `0` | TLS on MQTT connection | Promote to `1` default in production |
| `APP_FEATURE_OFFLINE_QUEUE` | `1` | Buffer logs in Octo-SPI when offline | Never — permanently enabled |
| `APP_FEATURE_ARGON2_PIN` | `0` | argon2 for PIN hashing (vs sha256+salt) | Promote to `1` if cycle count OK |
| `APP_FEATURE_WATCHDOG` | `1` | IWDG watchdog, prevents hung firmware | Never — permanently enabled |
| `APP_FEATURE_SDRAM_FRAMEBUFFER` | `1` | TouchGFX framebuffer in SDRAM | If porting to a board without SDRAM |

---

## Firmware — Live Flags (MQTT-pushed)

Topic `qc/config/flags` (retained, QoS 1). Not yet implemented in the
PoC; reserved for Phase 5+. The firmware subscribes to this topic and
applies flags without requiring a reflash.

Reserved flag names for future use:

| Name | Purpose |
|---|---|
| `show_rssi_debug` | Show RSSI value on-screen at all times |
| `verbose_log` | Increase log level to DEBUG at runtime |
| `disable_offline_queue` | Emergency kill-switch for queue drain |

The MQTT payload format when implemented:
```json
{
  "schema_version": 1,
  "flags": {
    "show_rssi_debug": false,
    "verbose_log": false
  }
}
```

---

## Adding a New Flag

1. **Choose the tier** using `docs/principles.md` § 4.
2. **Add it** to the appropriate location:
   - Build-time: `app_config.h` with `#ifndef` guard and a default.
   - Runtime: `server/app/config.py` Pydantic Settings field.
   - Live (server): insert a row into `feature_flags`.
   - Live (firmware): add to the `flags` payload parser.
3. **Document it here** with: name, default, purpose, removal criteria.
4. **Set a removal condition.** "Permanent" is acceptable only for
   config that will never be hardcoded (e.g., log level). Experimental
   flags must have a deadline or a concrete conclusion trigger.

---

## Removal Checklist

Before removing a flag:
- [ ] The intended behavior is now the only behavior in the codebase.
- [ ] The flag name is not referenced anywhere in source.
- [ ] No `.env` files or Mosquitto configs reference it.
- [ ] The removal is documented in `docs/decisions.md` if it was a
  significant behavioral change.
