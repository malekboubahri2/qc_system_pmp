# Firmware — Claude Code Context

STM32H750B-DK application: TouchGFX UI + FreeRTOS + LwIP + coreMQTT.

## Critical context

The board's internal flash is only 128 KB. TouchGFX assets (fonts, images,
screen layouts) live on external QSPI flash, memory-mapped at `0x90000000`.
Linker scripts must place `.gnu.linkonce.t.ttdf*` and similar TouchGFX sections
there. Do not "fix" linker scripts unless you understand the dual-flash layout.

## Layout

```
firmware/
├── PaintingQC.ioc                # CubeMX config
├── Core/                         # CubeMX-generated HAL init, main.c
├── Drivers/                      # HAL, BSP, CMSIS
├── Middlewares/                  # FreeRTOS, LwIP, coreMQTT, jsmn
├── TouchGFX/
│   ├── PaintingQC.touchgfx       # Designer file
│   ├── generated/                # Auto-generated, DO NOT EDIT BY HAND
│   ├── gui/
│   │   ├── include/{model,presenter,view}/
│   │   └── src/
│   └── target/                   # FreeRTOS task driving TouchGFX engine
├── Application/                  # Our application code, modular
│   ├── config/
│   │   ├── app_config.h          # Top-level build flags & feature macros
│   │   ├── app_errors.h          # Error code enum
│   │   └── app_version.h         # Generated from git tag at build
│   ├── platform/                 # Hardware Abstraction Layer (HAL)
│   │   ├── platform.h            # Public API
│   │   ├── platform_stm32h7.c    # Real implementation
│   │   ├── platform_host.c       # Host-side stub for unit tests
│   │   └── qspi_driver.{c,h}
│   ├── net/
│   │   ├── net.h
│   │   ├── net_task.c
│   │   └── sntp_client.{c,h}
│   ├── mqtt/
│   │   ├── mqtt_task.{c,h}
│   │   ├── mqtt_transport.{c,h} # LwIP glue for coreMQTT
│   │   └── mqtt_topics.h        # Topic strings, one source of truth
│   ├── persistence/
│   │   ├── config_store.{c,h}
│   │   └── defect_queue.{c,h}
│   ├── domain/                  # Business logic, NO hardware dependencies
│   │   ├── defect_config.{c,h}  # parser, validator, accessors
│   │   ├── operator_list.{c,h}
│   │   ├── session.{c,h}
│   │   └── pin_hash.{c,h}
│   ├── app_events.h             # FreeRTOS event group bits, queue handles
│   ├── app_log.h                # APP_LOG macro
│   └── main_app.c               # FreeRTOS task creation, kicks off everything
└── tests/                       # Host-side tests for portable modules
    ├── Makefile
    ├── mocks/
    └── test_*.c
```

## Modularity rules

- **Three concentric layers:** `domain/` (pure, portable) → `net/`,
  `persistence/`, `mqtt/` (use platform) → `platform/` (hardware).
  Arrows only go down. `domain/` never includes a HAL header.
- **One module = one folder or one `.c/.h` pair.** Header has only the public
  API; implementation details stay in `.c`. Use `static` aggressively.
- **No globals across module boundaries.** State exposed via accessor
  functions. Inter-module comms via queues/event groups declared in
  `app_events.h`.
- **No business logic in TouchGFX Views.** Views render; Presenters decide;
  Models hold state. Domain logic lives in `Application/domain/`, not in GUI code.
- **No HAL calls from Views or Presenters.** If a presenter needs persistence,
  it calls `config_store_*`, which calls the platform layer.

## Hardware Abstraction (`platform/`)

The platform layer is the single bridge between application code and the
STM32 HAL. Everything above it is portable.

`platform.h` defines a narrow interface:
```c
int  platform_init(void);
uint32_t platform_uptime_ms(void);
int  platform_random_bytes(uint8_t *out, size_t n);
int  platform_qspi_read(uint32_t offset, void *buf, size_t n);
int  platform_qspi_write(uint32_t offset, const void *buf, size_t n);
int  platform_qspi_erase_sector(uint32_t offset);
void platform_reboot(void);
/* … */
```

Two implementations:
- `platform_stm32h7.c` — real hardware, calls into STM32 HAL
- `platform_host.c` — runs on a Linux dev machine with files as fake QSPI

This makes `domain/`, `persistence/`, and most of `mqtt/` testable on a
laptop without flashing.

## Build Flags & Feature Macros

`Application/config/app_config.h` is the single source of truth for
compile-time configuration. Pattern:

```c
/* ============ Build target ============ */
#define APP_TARGET_STM32H7   1
#define APP_TARGET_HOST      2
#ifndef APP_TARGET
  #define APP_TARGET APP_TARGET_STM32H7
#endif

/* ============ Feature toggles ============ */
#ifndef APP_FEATURE_MQTT_TLS
  #define APP_FEATURE_MQTT_TLS       0   /* PoC: cleartext on plant LAN */
#endif

#ifndef APP_FEATURE_OFFLINE_QUEUE
  #define APP_FEATURE_OFFLINE_QUEUE  1
#endif

#ifndef APP_FEATURE_ARGON2_PIN
  #define APP_FEATURE_ARGON2_PIN     0   /* fallback: sha256+salt */
#endif

#ifndef APP_FEATURE_WATCHDOG
  #define APP_FEATURE_WATCHDOG       1
#endif

/* ============ Sizing ============ */
#define APP_MAX_DEFECTS_PER_CATEGORY 12
#define APP_MAX_CATEGORIES           2
#define APP_DEFECT_LABEL_MAX         24
#define APP_OPERATOR_LIST_MAX        32
#define APP_DEFECT_QUEUE_DEPTH       1000

/* ============ Timing ============ */
#define APP_MQTT_STATUS_PERIOD_MS    30000
#define APP_MQTT_RECONNECT_MAX_MS    30000
#define APP_SNTP_RESYNC_PERIOD_MS    3600000  /* 1h */

/* ============ Logging ============ */
#define APP_LOG_LEVEL_NONE  0
#define APP_LOG_LEVEL_ERROR 1
#define APP_LOG_LEVEL_WARN  2
#define APP_LOG_LEVEL_INFO  3
#define APP_LOG_LEVEL_DEBUG 4

#ifndef APP_LOG_LEVEL
  #ifdef DEBUG
    #define APP_LOG_LEVEL APP_LOG_LEVEL_DEBUG
  #else
    #define APP_LOG_LEVEL APP_LOG_LEVEL_INFO
  #endif
#endif
```

Rules:
- **Every feature toggleable** at compile time gets an `APP_FEATURE_*` macro
  with a sane default
- Use `#if APP_FEATURE_X` blocks, NOT `#ifdef` — that way the macro is always
  defined and accidentally-undefined macros become compile errors
- Pass overrides via `-DAPP_FEATURE_X=1` in CubeIDE project settings or
  `Makefile`. Never edit `app_config.h` to disable a feature for one build.
- Sizing macros let us tune per target (e.g., smaller queue on a future
  L-series port)
- All `#define`s here are documented in `docs/build-flags.md`

## Inter-task communication

`Application/app_events.h` declares:
- FreeRTOS event group `app_events` with named bits:
  - `EVT_NET_LINK_UP`, `EVT_NET_LINK_DOWN`
  - `EVT_MQTT_CONNECTED`, `EVT_MQTT_DISCONNECTED`
  - `EVT_CONFIG_UPDATED`, `EVT_OPERATORS_UPDATED`
  - `EVT_QUEUE_NONEMPTY`
- Queues:
  - `q_mqtt_publish` (presenter → mqtt_task)
  - `q_log_writer` (anyone → log task, optional)

Never declare ad-hoc globals to share state. Use the events module.

## Tasks (FreeRTOS)

| Task | Priority | Stack | Purpose |
|---|---|---|---|
| `GUI_Task` (TouchGFX) | normal | 4 KB | TouchGFX engine, screen rendering |
| `mqtt_task` | normal | 4 KB | coreMQTT loop, reconnect, queue drain |
| `net_task` | high | 2 KB | LwIP `tcpip_thread` (managed by LwIP) |
| `sntp_task` | low | 1 KB | Periodic time sync |
| `queue_task` | low | 2 KB | Drain offline defect queue on reconnect |
| `wdg_task` | highest | 512 B | Aggregate task heartbeats, kick IWDG |

## Memory map (high level)

- `0x08000000` — internal flash (128 KB) — bootloader + tiny core
- `0x24000000` — AXI SRAM (512 KB) — heap, stacks, framebuffers
- `0x30000000` — D2 SRAM — Ethernet descriptors (uncached region)
- `0x90000000` — QSPI flash (128 MB), memory-mapped:
  - `0x90000000`–`0x907FFFFF` — TouchGFX assets
  - `0x90800000`–`0x9080FFFF` — Config store (defect/operator cache)
  - `0x90810000`–`0x908FFFFF` — Defect log offline queue (circular)

## Conventions

- C11. No C++ outside TouchGFX-generated code.
- Header guards `#ifndef APP_FOO_H` style. No `#pragma once`.
- One `init`, one `task` function per module.
- Error returns: `int`, 0 = ok, negative = error code from `app_errors.h`.
- Logging:
  ```c
  APP_LOG(APP_LOG_LEVEL_INFO, "mqtt", "connected to %s", host);
  ```
  Macro evaluates to nothing if level exceeds `APP_LOG_LEVEL`. Zero overhead
  in release builds.
- File header comment with one-sentence purpose. No author tags.

## Host-side tests

`tests/` builds on a Linux/macOS host using `platform_host.c`.
Run with `make test`. Tests cover:
- `defect_config` JSON parsing (fuzz with malformed inputs)
- `operator_list` parsing
- `defect_queue` circular buffer (including simulated power-loss)
- `pin_hash` correctness
- `config_store` round-trip with fake QSPI

Anything in `domain/` MUST have host tests. Anything in `platform/` cannot.
Modules in between may have partial coverage.

## DO NOT

- Do not edit anything under `TouchGFX/generated/`. Regenerate from Designer.
- Do not call HAL functions from anywhere but `platform/`.
- Do not use `printf` directly. Use `APP_LOG`.
- Do not enable Wi-Fi peripherals. Wired-only.
- Do not add a feature without an `APP_FEATURE_*` flag if it could ever be
  optional.
- Do not increase task stack sizes without checking `uxTaskGetStackHighWaterMark`.
- Do not put domain logic in TouchGFX View/Presenter code — keep it in
  `Application/domain/` so it's testable on the host.

## Useful debug commands

- ST-Link CLI flash: `STM32_Programmer_CLI -c port=SWD -w PaintingQC.elf -rst`
- Live SWO log capture: `STM32_Programmer_CLI -c port=SWD -SWV portb=2000000`
- Host tests: `cd firmware/tests && make && ./run_tests`
