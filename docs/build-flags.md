# Firmware Build Flags

All compile-time configuration for the STM32 firmware lives in
`firmware/Application/config/app_config.h`. This document is the
reference for every macro defined there.

For runtime and live flags (server-side), see `docs/feature-flags.md`.

---

## How to Override

Never edit `app_config.h` to disable a feature for one build. Instead,
pass overrides at the CubeIDE project level:

**CubeIDE:** Project Properties → C/C++ Build → Settings → MCU GCC
Compiler → Preprocessor → add `-DAPP_FEATURE_X=1`.

**Makefile / CI:**
```bash
arm-none-eabi-gcc -DAPP_FEATURE_MQTT_TLS=1 -DAPP_TARGET=2 ...
```

**Host tests:**
```bash
cd firmware/tests && make APP_TARGET=2 APP_NET_BACKEND=3
```

Always use `#if APP_FEATURE_X` (not `#ifdef`). An undefined macro
becomes a compile error, not a silent false — this is intentional.

---

## Build Target

| Macro | Value | Meaning |
|---|---|---|
| `APP_TARGET_STM32H7B3` | 1 | Real hardware (STM32H7B3LIH6Q) |
| `APP_TARGET_HOST` | 2 | Linux/macOS host (for unit tests) |
| `APP_TARGET` | default: 1 | Active target |

When `APP_TARGET == APP_TARGET_HOST`, the platform layer compiles
`platform_host.c` instead of `platform_stm32h7b3.c`. Domain modules
are unchanged.

---

## Network Backend

Selects which implementation of `net.h` is compiled in.

| Macro | Value | Meaning |
|---|---|---|
| `APP_NET_BACKEND_WIFI_ISM43340` | 1 | Inventek ISM43340 over SPI (default) |
| `APP_NET_BACKEND_ETH_W5500` | 2 | WIZnet W5500 SPI shield (future) |
| `APP_NET_BACKEND_HOST` | 3 | POSIX sockets for host tests |
| `APP_NET_BACKEND` | default: 1 | Active backend |

The MQTT transport, SNTP client, and queue task all call `net_*`
functions — they have no knowledge of which backend is active. Swapping
Wi-Fi for wired Ethernet changes only this flag and the board bring-up
code in `platform_stm32h7b3.c`.

---

## Feature Flags (APP_FEATURE_*)

| Macro | Default | Purpose | When to flip |
|---|---|---|---|
| `APP_FEATURE_MQTT_TLS` | `0` | Enable TLS on the MQTT connection | Production deployment with sensitive data |
| `APP_FEATURE_OFFLINE_QUEUE` | `1` | Buffer defect logs in Octo-SPI when disconnected | Never disable for PoC |
| `APP_FEATURE_ARGON2_PIN` | `0` | Use argon2 for PIN hashing (vs sha256+salt) | If argon2 cycle count proves acceptable on H7B3 |
| `APP_FEATURE_WATCHDOG` | `1` | Enable IWDG watchdog timer | Disable only during debugging |
| `APP_FEATURE_SDRAM_FRAMEBUFFER` | `1` | Place TouchGFX framebuffer in SDRAM | Always 1 on H7B3I-DK (has 16 MB SDRAM) |

**`APP_FEATURE_MQTT_TLS`**  
When enabled, `mqtt_transport.c` wraps the socket in an mbedTLS context.
Requires provisioning per-device certificates (not implemented in PoC).
See `CLAUDE.md` → Wi-Fi Operational Considerations for the security
trade-off.

**`APP_FEATURE_OFFLINE_QUEUE`**  
When disabled, defect taps are dropped silently if MQTT is not connected.
Only disable for debugging the MQTT path in isolation.

**`APP_FEATURE_ARGON2_PIN`**  
When enabled, PIN verification calls the argon2 library. Verify on real
hardware that the KDF completes in < 1 s before enabling. If too slow,
keep at `0` (sha256+salt is still secure for 4-digit PINs with proper
salting and rate limiting).

**`APP_FEATURE_WATCHDOG`**  
When enabled, `wdg_task` expects a heartbeat from every other task within
`APP_WATCHDOG_WINDOW_MS`. A hung task causes a system reset. Disable
during debugging to prevent resets during breakpoints.

---

## Sizing

These control static buffer and queue sizes. Change only if requirements
change; they affect flash and RAM consumption.

| Macro | Default | Meaning |
|---|---|---|
| `APP_MAX_DEFECTS_PER_CATEGORY` | `12` | Max defect buttons per column (4×3 grid) |
| `APP_MAX_CATEGORIES` | `2` | Max categories shown on device UI |
| `APP_DEFECT_LABEL_MAX` | `24` | Max chars in a defect label (null not counted) |
| `APP_OPERATOR_LIST_MAX` | `32` | Max operators in the operator list payload |
| `APP_DEFECT_QUEUE_DEPTH` | `1000` | Max queued defect logs in Octo-SPI (~24h at typical rate) |

`APP_MAX_DEFECTS_PER_CATEGORY` must match the server-side cap enforced
in `services.defect_types` and documented in `docs/data-model.md`.

---

## Timing

| Macro | Default | Meaning |
|---|---|---|
| `APP_MQTT_STATUS_PERIOD_MS` | `30000` | How often to publish the status heartbeat (30 s) |
| `APP_MQTT_RECONNECT_MAX_MS` | `30000` | Max backoff between MQTT reconnect attempts |
| `APP_WIFI_RECONNECT_MAX_MS` | `30000` | Max backoff between Wi-Fi association attempts |
| `APP_SNTP_RESYNC_PERIOD_MS` | `3600000` | SNTP resync interval (1 h) |
| `APP_WATCHDOG_WINDOW_MS` | `6000` | Task heartbeat window before watchdog fires |

The server considers a device offline after 90 s of no heartbeat —
three missed `APP_MQTT_STATUS_PERIOD_MS` intervals.

---

## Logging

| Macro | Value | Meaning |
|---|---|---|
| `APP_LOG_LEVEL_NONE` | 0 | No output |
| `APP_LOG_LEVEL_ERROR` | 1 | Errors only |
| `APP_LOG_LEVEL_WARN` | 2 | Warnings and errors |
| `APP_LOG_LEVEL_INFO` | 3 | Normal operation (default release) |
| `APP_LOG_LEVEL_DEBUG` | 4 | Verbose (default debug build) |
| `APP_LOG_LEVEL` | auto | `DEBUG` if `-DDEBUG` is set, else `INFO` |

Log output goes to SWO via ITM. Capture with:
```bash
STM32_Programmer_CLI -c port=SWD -SWV portb=2000000
```

`APP_LOG` compiles to nothing when level exceeds `APP_LOG_LEVEL`, so
debug logging has zero overhead in release builds.
