# Firmware — KPI andon board (ADR-017)

The STM32 firmware is a **git submodule** at **`firmware/qc_andon`**
(<https://github.com/malekboubahri2/qc_andon>). After cloning this repo:

```bash
git submodule update --init firmware/qc_andon
```

It targets the **STM32H7B3I-DK** (Cortex-M7 @ 280 MHz, 4.3" 480×272 LCD,
Octo-SPI, ST-LINK-V3E), **TouchGFX + FreeRTOS**, Wi-Fi via an external **ESP-01
(ESP8266)** over USART/AT — **no LwIP** (the module owns the IP stack). It is a
**display-only** KPI andon board (ADR-017): it fetches `GET /kpi/board` and
renders big numbers; the inspection flow lives in the web PWA, not here.

## Source-tree gotcha (inside the submodule)

The CubeIDE target build compiles **untracked** copies under
`STM32CubeIDE/net|log`. Those copies also hold the **real** provisioned
Wi-Fi/station credentials, so they are **gitignored and never committed** — the
tracked `Application/.../kpi_config.h` carries only placeholders. The git source
of truth is under `Application/`; after editing `Application/net|log|kpi`, sync
the change into the `STM32CubeIDE/` copies or the build won't see it.
`TouchGFX/gui/**` is single-source (no duplication).

## Hard-won lessons (carry forward)

- **ESP-01 send timing** — reliability couples to settle delays in `esp01_send`.
  Use `osDelay`, never `HAL_Delay`, in task context (yield vs busy-wait).
- **Octo-SPI vs TouchGFX DMA2D hazard** — don't write OSPI while the UI renders
  assets from it (controller corruption / UI freeze).
- **TouchGFX Designer is fragile** — regen can wipe screens and rename
  typed-text ids; generated files are gitignored. Dynamic text needs a
  **wildcard** `TextArea` (you can't render arbitrary strings into a static one).

## DO NOT

- Do not add an input/inspection flow — it is display-only.
- Do not introduce LwIP; the ESP-01 owns the IP stack.
- Do not write to Octo-SPI while the UI renders (DMA2D hazard).
- Do not hardcode Wi-Fi/station creds in tracked source — only the untracked
  built copies carry real values.
