# Firmware — Claude Code Context (KPI andon board, ADR-017)

The STM32 is now a **display-only KPI "andon" board** on the wall: it fetches a
few quality KPIs and renders them as big numbers for anyone in the room. It is
**not** the inspection terminal anymore — inspection moved to the web PWA
(ADR-017). The retired inspection-terminal firmware is history; its decisions
live in ADR-013/014/015/016.

## Where the code actually is

The live project is **`C:\TouchGFXProjects\qc_node`** (its own git repo, *not*
in this monorepo's `firmware/`). It mixes two source trees:
- `Application/<area>/` — some compiled units live here (e.g. `net/`).
- `STM32CubeIDE/Application/User/<area>/` — the **copies the CubeIDE build
  actually compiles** for `mqtt/`, `netif/`, `log/`, `time/`, `domain/`.
- `TouchGFX/generated/` — **generated, gitignored, DO NOT hand-edit** (except as
  a last-resort recovery; the Designer overwrites it). A keep-able snapshot is
  backed up under this repo's `firmware/TouchGFX/`.
When editing a duplicated unit, change the **compiled** copy (the `STM32CubeIDE`
one) — confirm with `subdir.mk`/the build output.

## Hardware & transport

- STM32H7B3I-DK (Cortex-M7 @ 280 MHz, 4.3" 480×272 LCD, 16 MB SDRAM, 64 MB
  Octo-SPI, ST-LINK-V3E).
- Wi-Fi via external **ESP-01 (ESP8266)** on **USART2**, Hayes AT commands,
  DMA RX-to-idle (ADR-015). **No LwIP** — the ESP-01 owns the IP stack. We use a
  TCP client only.
- KPI transport — pluggable via a build flag:
  - **Default: HTTP** — `GET /kpi` every few seconds, parse JSON, render.
  - **Option: MQTT** — coreMQTT subscribe to retained `qc/display/kpi` (reuses
    the existing, working agent/transport). Use if HTTP-over-AT is awkward.

## What it does / does NOT do

Does: Wi-Fi connect → fetch KPIs → render big numbers (Taux NC PMP/INJ, parts
inspected, NC count) via TouchGFX wildcard TextAreas → connection indicator.

Does NOT (all removed vs the old terminal): login, product/defect grids, commit
flow, offline queue, session, SNTP, config push. Keep it that way.

## Modularity

- Keep the **KPI transport behind one interface** (an HTTP fetch fn or an MQTT
  subscribe), selected by a flag — swapping HTTP↔MQTT is a contained change.
- TouchGFX: Views render, no business logic; a tiny model holds the latest KPI
  snapshot. No HAL calls from Views.
- One concept per file; public API in the header, rest `static`.

## Hard-won lessons (carry these forward)

- **ESP-01 send timing.** Reliability was coupled to log verbosity. Fix: explicit
  `osDelay` settles in `esp01_send` (`ESP01_CIPSEND_PRE_SETTLE_MS`,
  `ESP01_CIPSEND_PROMPT_SETTLE_MS`) + publish pacing. Use `osDelay`, never
  `HAL_Delay`, in task context (yields vs busy-wait).
- **Octo-SPI vs TouchGFX DMA2D hazard.** Writing OSPI while TouchGFX reads assets
  from it corrupts the controller (UI freeze). The andon board should avoid OSPI
  writes entirely — another reason it has no offline queue.
- **TouchGFX Designer is fragile.** Regen can wipe screens and rename typed-text
  ids (`T_X` → `T_T_X`). Generated files are gitignored — keep the
  `firmware/TouchGFX/` backup current. Dynamic text needs a **wildcard** typed
  text; you can't render arbitrary strings into a static `TextArea`.
- **Broker auth drift.** Mosquitto re-copies the bind-mounted `passwd`/`acl` on
  restart; out-of-band edits to the running container get wiped. Persist device
  accounts in the host files (and root-own them).

## Build flags

Compile-time config in the project's `app_config.h` / per-module headers. Every
toggle gets a macro with a default; use `#if`, not `#ifdef`. The KPI transport,
poll interval, and the plant-local TZ offset are flags. Document new flags in
`docs/build-flags.md`.

## DO NOT

- Do not add an input/inspection flow back to the device — it is display-only.
- Do not introduce LwIP; the ESP-01 owns the IP stack.
- Do not hand-edit `TouchGFX/generated/` (recover from the Designer or the
  `firmware/TouchGFX/` backup instead).
- Do not write to Octo-SPI while the UI renders (DMA2D hazard).
- Do not hardcode Wi-Fi/broker creds in source — provisioning store only.
- Do not use `HAL_Delay` in a FreeRTOS task; use `osDelay`.
