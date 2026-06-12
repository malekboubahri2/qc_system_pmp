# Firmware Versions

Pinned toolchain and component versions for the STM32 **andon KPI board**
(ADR-017/020). The live project is the `firmware/qc_andon` submodule, built in
STM32CubeIDE on the host.

| Component | Version | Notes |
|---|---|---|
| Target board | STM32H7B3I-DK | STM32H7B3LIH6Q, Cortex-M7 @ 280 MHz (ADR-001) |
| STM32CubeMX | 6.17.0 | HAL / project generation |
| STM32Cube FW_H7 | 1.13.0 | HAL firmware package |
| TouchGFX | 4.26.0 | display framework (ADR-009) |
| RTOS | FreeRTOS via CMSIS-RTOS2 | |
| MQTT (optional) | vendored coreMQTT | only for the MQTT KPI-subscribe option (ADR-008) |
| Wi-Fi transport | external ESP-01 (ESP8266), AT over USART | module owns the IP stack; **no LwIP** (ADR-015) |

The **ESP-01 AT firmware** version is read off each module and recorded per
device at provisioning time (it is hardware, not a repo-pinned value), so it is
not listed here.

> The previous on-board **ISM43340** Wi-Fi module and its `C3.5.2.x.STM` driver
> firmware were retired by ADR-015 (ESP-01 supersedes the ISM43340 transport).
> The historical ADR-001/004/005/011 references to this file predate that pivot.
