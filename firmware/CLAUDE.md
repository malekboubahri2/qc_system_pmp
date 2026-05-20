# Firmware — Claude Code Context

STM32H7B3I-DK application: TouchGFX UI + FreeRTOS + Inventek Wi-Fi + coreMQTT.

## Critical context

**No LwIP.** The on-board Inventek ISM43340 Wi-Fi module is not a bare radio;
it's a self-contained networking appliance with its own STM32F405 host and a
full TCP/IP stack. The H7B3 host MCU controls it over SPI via an AT-command-
style protocol. Our firmware uses the module's socket API (open/connect/
send/recv/close); we do not run a TCP/IP stack ourselves.

The MCU is the STM32H7B3LIH6Q: 2 MB internal flash, 1.4 MB internal RAM,
single Cortex-M7 @ 280 MHz (NOT dual-core — some web sources are wrong).
On-board: 16 MB SDRAM and 64 MB Octo-SPI flash, both memory-mappable.

Internal flash is generous enough to hold all application code and many
TouchGFX assets; we do NOT need the dual-flash linker complexity that
the H750B-DK forces. Octo-SPI is used for asset overflow (large images
or fonts), the config store, and the offline defect queue.

## Layout

```
firmware/
├── PaintingQC.ioc                # CubeMX config
├── Core/                         # CubeMX-generated HAL init, main.c
├── Drivers/                      # HAL, BSP, CMSIS
│   └── BSP/                      # Board support, includes ISM43340 driver bring-up
├── Middlewares/
│   ├── ST/
│   │   └── STM32_Network_Library/  # vendored from STM32CubeH7
│   ├── coreMQTT/                   # AWS, MIT, vendored
│   ├── jsmn/                       # JSON tokenizer, MIT, vendored
│   └── Third_Party/FreeRTOS/       # via CubeMX
├── TouchGFX/
│   ├── PaintingQC.touchgfx       # Designer file
│   ├── generated/                # Auto-generated, DO NOT EDIT BY HAND
│   ├── gui/
│   │   ├── include/{model,presenter,view}/
│   │   └── src/
│   └── target/                   # FreeRTOS task driving TouchGFX engine
├── Application/
│   ├── config/
│   │   ├── app_config.h          # Build flags & feature macros
│   │   ├── app_errors.h          # Error code enum
│   │   └── app_version.h         # Generated from git tag at build
│   ├── platform/                 # Hardware Abstraction Layer (HAL)
│   │   ├── platform.h            # Public API: stable across hardware swaps
│   │   ├── platform_stm32h7b3.c  # Real implementation
│   │   ├── platform_host.c       # Host-side stub for unit tests
│   │   └── octospi_driver.{c,h}
│   ├── net/
│   │   ├── net.h                 # Public socket API our app uses
│   │   ├── net_wifi_ism43340.c   # Default: Wi-Fi via Inventek module
│   │   ├── net_eth_w5500.c       # Alternate: future wired Ethernet shield
│   │   ├── net_host.c            # Host stub for tests
│   │   └── sntp_client.{c,h}     # Uses net.h, transport-agnostic
│   ├── mqtt/
│   │   ├── mqtt_task.{c,h}
│   │   ├── mqtt_transport.{c,h}  # coreMQTT transport — calls net.h
│   │   └── mqtt_topics.h         # Topic strings, single source of truth
│   ├── persistence/
│   │   ├── config_store.{c,h}    # Octo-SPI-backed config cache
│   │   └── defect_queue.{c,h}    # Octo-SPI circular buffer
│   ├── domain/                   # Business logic, NO hardware dependencies
│   │   ├── defect_config.{c,h}
│   │   ├── operator_list.{c,h}
│   │   ├── session.{c,h}
│   │   └── pin_hash.{c,h}
│   ├── app_events.h              # FreeRTOS event group bits, queue handles
│   ├── app_log.h                 # APP_LOG macro
│   └── main_app.c                # FreeRTOS task creation
└── tests/                        # Host-side tests for portable modules
    ├── Makefile
    ├── mocks/
    └── test_*.c
```

## Modularity rules

- **Three concentric layers:** `domain/` (pure, portable) → `net/`,
  `persistence/`, `mqtt/` (use platform & net) → `platform/` (hardware).
  Arrows only go down. `domain/` never includes a HAL header.
- **One module = one folder or one `.c/.h` pair.** Header has only the
  public API; everything else `static`.
- **No globals across module boundaries.** State exposed via accessor
  functions. Inter-module comms via queues/event groups in `app_events.h`.
- **No business logic in TouchGFX Views.** Views render; Presenters
  decide; Models hold state. Domain logic in `Application/domain/`.
- **No HAL calls from Views, Presenters, or domain.** If they need
  persistence, they call `config_store_*`, which calls the platform layer.
- **TouchGFX screen flow (ADR-013):** splash → login → product selection
  → defect grid → summary. Product selection is mandatory before defect
  logging. The firmware must not allow reaching the defect grid without
  a valid `product_id` in the session context.

## Network abstraction (critical for portability)

The whole point of `net/` is that the rest of the codebase doesn't care
*how* IP packets get out. `net.h` defines a minimal socket-like API:

```c
typedef int net_socket_t;

int  net_init(const net_config_t *cfg);   /* SSID, PSK, etc. */
int  net_connect_ap(void);
int  net_disconnect_ap(void);
bool net_is_link_up(void);
int  net_get_ip(uint8_t out_ip[4]);

net_socket_t net_socket_open(net_proto_t proto);
int  net_socket_connect(net_socket_t s, const char *host, uint16_t port);
int  net_socket_send(net_socket_t s, const void *buf, size_t n, uint32_t to_ms);
int  net_socket_recv(net_socket_t s, void *buf, size_t n, uint32_t to_ms);
int  net_socket_close(net_socket_t s);

int  net_sntp_sync(const char *server, uint32_t *out_unix_time);
```

Three implementations selected at build time:
- `net_wifi_ism43340.c` — default. **Thin shim** (~50 lines) over the
  ST Network Library (`Middlewares/ST/STM32_Network_Library/`), vendored
  from STM32CubeH7. The Network Library provides a socket-like API
  (`net_sock_create`, `net_sock_open`, `net_sock_send`, `net_sock_recv`,
  `net_sock_close`) and itself wraps the es-wifi BSP driver (in
  `Drivers/BSP/Components/es-wifi/`, also vendored from CubeH7).
  Our shim's responsibilities: map between our `net.h` API and the
  Network Library, own FreeRTOS event signaling
  (`EVT_WIFI_CONNECTED/DISCONNECTED`), and own reconnect-with-backoff
  orchestration. The Network Library does NOT do reconnect orchestration
  on its own — we layer that on top.
- `net_eth_w5500.c` — future fallback if Wi-Fi proves unreliable.
  Uses WIZnet ioLibrary for an SPI-attached W5500 shield.
- `net_host.c` — POSIX sockets, for host-side tests.

Selection via `APP_NET_BACKEND` macro in `app_config.h`. The MQTT
transport, SNTP client, and queue task all call `net_*` functions —
they don't know which backend is active. **This is what makes the
Wi-Fi/Ethernet swap a contained change later.**

## Wi-Fi specifics (ISM43340)

- **SPI peripheral: SPI2** (per H7B3I-DK schematic, default solder-bridge
  configuration). NOT SPI4. The L4S5I-IOT01A reference uses SPI3; copy
  the driver structure but reconfigure the SPI instance for our board.
- GPIO control lines (default solder-bridge config):
  - `WIFI_DATRDY` on PI5 (EXTI — signals module has data to send)
  - `WIFI_RST` on PI1 (active-low reset)
  - `WIFI_WKUP` on PI2
  - `WIFI_GPIO` on PI4
  - `WIFI_NSS` on (verify in `.ioc` — exposed via SPI2 chip select)
- **Shipped module firmware:** `C3.5.2.6.STM.BETA4` (verify on first boot;
  see the module's firmware-query AT command output in logs). This version
  has a documented limitation: network scan operates only once after each
  module reset. We do NOT scan at runtime (SSID comes from provisioning),
  so this likely does not affect us — but it is the suspected root cause
  of community reports of flaky reconnect-after-disconnect.
- **Firmware upgrade path** (contingency, not initial plan):
  Inventek `C6.2.1.11.E` SPI firmware available at inventeksys.com.
  Upgrade procedure (from UM2569): remove R30 and R32, wire SWDIO from
  R30-right to TP4, wire SWCLK from R32-right to TP5, then flash via the
  on-board ST-LINK-V3E. This is a one-time hardware mod per board.
  **Do this only if Day 18 reconnect testing fails.** Document in
  `docs/firmware-versions.md` the version actually in use.
- Reconnect strategy: on link loss, exponential backoff up to 30s.
  Orchestrated by our `net_task` calling Network Library functions —
  not by the Network Library itself (which would just return errors and
  leave reconnect to the caller). After N=5 consecutive failures, issue
  a hardware reset via `WIFI_RST` before retrying, to recover from any
  module-side state-machine hangs.
- Persist last-known-good AP credentials in Octo-SPI (provisioned at
  flash time, never hardcoded).
- We use **TCP client sockets only.** No HTTP, no module's HTTP server.
  The MQTT transport opens a TCP connection to the broker, sends MQTT
  framing bytes, and reads responses — that's the whole API surface
  we need from the Wi-Fi module.

## Build Flags & Feature Macros

`Application/config/app_config.h` is the single source of truth for
compile-time configuration.

```c
/* ============ Build target ============ */
#define APP_TARGET_STM32H7B3   1
#define APP_TARGET_HOST        2
#ifndef APP_TARGET
  #define APP_TARGET APP_TARGET_STM32H7B3
#endif

/* ============ Network backend ============ */
#define APP_NET_BACKEND_WIFI_ISM43340  1
#define APP_NET_BACKEND_ETH_W5500      2
#define APP_NET_BACKEND_HOST           3
#ifndef APP_NET_BACKEND
  #define APP_NET_BACKEND APP_NET_BACKEND_WIFI_ISM43340
#endif

/* ============ Feature toggles ============ */
#ifndef APP_FEATURE_MQTT_TLS
  #define APP_FEATURE_MQTT_TLS       0   /* PoC: cleartext */
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
#ifndef APP_FEATURE_SDRAM_FRAMEBUFFER
  #define APP_FEATURE_SDRAM_FRAMEBUFFER 1  /* H7B3 has SDRAM, use it */
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
#define APP_WIFI_RECONNECT_MAX_MS    30000
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
- **Every toggleable feature** gets an `APP_FEATURE_*` macro with a default
- Use `#if APP_FEATURE_X`, not `#ifdef` — accidentally-undefined macros
  become compile errors
- Pass overrides via `-DAPP_FEATURE_X=1` in CubeIDE → C/C++ Build →
  Settings → Preprocessor
- Sizing macros allow tuning per future target (e.g., smaller queue
  on an L-series port)
- All `#define`s here are documented in `docs/build-flags.md`

## Inter-task communication

`Application/app_events.h` declares:
- FreeRTOS event group `app_events` with named bits:
  - `EVT_WIFI_CONNECTED`, `EVT_WIFI_DISCONNECTED`
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
| `net_task` | high | 3 KB | Wi-Fi link management, reconnect |
| `mqtt_task` | normal | 4 KB | coreMQTT loop, reconnect, publish queue |
| `sntp_task` | low | 1 KB | Periodic time sync |
| `queue_task` | low | 2 KB | Drain offline defect queue on reconnect |
| `wdg_task` | highest | 512 B | Aggregate heartbeats, kick IWDG |

## Memory map (high level)

H7B3I-DK has substantially more on-chip memory than the H750:
- `0x08000000` — internal flash (2 MB) — application code + small assets
- `0x20000000` — DTCM SRAM (128 KB) — fast, no DMA — FreeRTOS heap here
- `0x24000000` — AXI SRAM (512 KB) — general-purpose
- `0x30000000` — D2 SRAM (288 KB) — peripheral DMA buffers
- `0x38000000` — D3 SRAM (64 KB) — backup-domain RAM
- `0x60000000` — FMC/SDRAM (16 MB) — TouchGFX framebuffer, asset cache
- `0x90000000` — Octo-SPI flash (64 MB), memory-mapped:
  - `0x90000000`–`0x907FFFFF` — TouchGFX asset overflow (if needed)
  - `0x90800000`–`0x9080FFFF` — Config store
  - `0x90810000`–`0x908FFFFF` — Defect log offline queue (circular)
  - `0x90820000`–`0x9082FFFF` — Wi-Fi credentials (provisioning sector)

Exact offsets validated against linker script before code freeze.

## Conventions

- C11. No C++ outside TouchGFX-generated code.
- Header guards `#ifndef APP_FOO_H`. No `#pragma once`.
- One `init`, one `task` function per module.
- Error returns: `int`, 0 = ok, negative = error from `app_errors.h`.
- Logging:
  ```c
  APP_LOG(APP_LOG_LEVEL_INFO, "wifi", "connected to %s", ssid);
  ```
  Compiles to nothing if level exceeds `APP_LOG_LEVEL`.
- File header comment with one-sentence purpose. No author tags.

## Host-side tests

`tests/` builds on a Linux/macOS host using `platform_host.c` and
`net_host.c`. Run with `make test`. Tests cover:
- `defect_config` JSON parsing (fuzz with malformed inputs)
- `operator_list` parsing
- `defect_queue` circular buffer (including simulated power-loss)
- `pin_hash` correctness
- `config_store` round-trip with fake Octo-SPI
- `mqtt_transport` against a real Mosquitto on localhost

Anything in `domain/` MUST have host tests. Anything in `platform/`
cannot. Modules in between have partial coverage.

## DO NOT

- Do not introduce LwIP. The Wi-Fi module is the IP stack.
- Do not edit anything under `TouchGFX/generated/`. Regenerate from Designer.
- Do not call HAL functions from anywhere but `platform/` and the
  ISM43340 driver internals.
- Do not use `printf` directly. Use `APP_LOG`.
- Do not hardcode SSID, PSK, or broker IP in source. Provisioning writes
  them to Octo-SPI.
- Do not add a feature without an `APP_FEATURE_*` flag if it could be
  optional.
- Do not increase task stack sizes without checking
  `uxTaskGetStackHighWaterMark`.
- Do not put domain logic in TouchGFX View/Presenter code.
- Do not use the ST Network Library's API directly from anywhere except
  `Application/net/net_wifi_ism43340.c`. The rest of the codebase calls
  `net.h`. This keeps the Network Library swappable.
- Do not subscribe to `qc/config/defects` — that topic no longer exists.
  The correct topic is `qc/config/products` (schema_version 2,
  product-scoped payload). See ADR-013 in `docs/decisions.md` and the
  full schema in `docs/mqtt-topics.md`.
- Do not publish `qc/device/{id}/defect` with a free-text `product_ref`
  field. schema_version 2 carries `product_id` (integer) and `note`
  (nullable string). Reject cached queue entries with schema_version 1
  on firmware upgrade.
- **[ADR-014 — pending firmware work]** The next firmware iteration must
  migrate from `qc/device/{id}/defect` (schema_version 2) to
  `qc/device/{id}/inspection` (schema_version 3). Key changes:
  - Add `outcome` field (`"DEFECT"` | `"OK"`) to the MQTT payload.
  - Add an "OK" button to the defect-grid screen. When tapped, publish
    with `outcome="OK"` and no `defect_type_id`.
  - When a defect button is tapped, publish with `outcome="DEFECT"` and
    `defect_type_id` set as before.
  - Update `mqtt_topics.h`: rename `MQTT_TOPIC_DEFECT` →
    `MQTT_TOPIC_INSPECTION`. Update `defect_queue` entry struct to carry
    `outcome` and nullable `defect_type_id`.
  - The server's `qc/device/{id}/defect` handler now discards all
    messages. Old firmware will lose data once server is updated; update
    firmware first.

## MQTT ↔ UI Integration — What To Wire Up

This section maps every stub/hardcoded value in the TouchGFX UI to the
MQTT data it must eventually receive or publish. Do these in order.

### Current stubs (what is hardcoded today)

| Screen | File | Stub |
|--------|------|------|
| Login | `gui/src/model/Model.cpp` | `s_operators[]` — 3 hardcoded operators |
| Product ref | `gui/src/productref_screen/productRefView.cpp` | `setNumberOfItems(3)` — 3 dummy rows; no `product_id` stored |
| Defects PMP | `gui/src/defects_pmp_screen/defects_pmpPresenter.cpp` | `logDefectInspection()` and `logOkInspection()` are empty TODOs |
| Defects INJ | `gui/src/defects_inj_screen/defects_injPresenter.cpp` | same two TODOs |
| Summary | `gui/src/summary_screen/summaryPresenter.cpp` | already wired to model; needs real defect count |

### Step 1 — Expand `Model` (the single source of truth for the UI)

File: `gui/include/gui/model/Model.hpp` + `gui/src/model/Model.cpp`

Add these structs and methods (keep `operator_entry_t` — just change the
backing storage from a static array to a settable buffer):

```cpp
/* Incoming from qc/config/operators */
void setOperators(const operator_entry_t* list, int count);
int  getOperatorCount() const;
// validatePin() and getOperator() already exist — no change needed

/* Incoming from qc/config/products */
struct product_entry_t {
    int  id;
    char name[32];
};
struct defect_type_t {
    int  id;
    char label[APP_DEFECT_LABEL_MAX + 1];
};
void setProducts(const product_entry_t* list, int count);
int  getProductCount() const;
const product_entry_t& getProduct(int idx) const;

void setDefectTypes(int product_id, int category,   // category: 0=PMP 1=INJ
                    const defect_type_t* list, int count);
const defect_type_t* getDefectTypes(int product_id, int category,
                                     int* out_count) const;

/* Set by productRefPresenter when operator picks a row */
void setCurrentProductId(int id);
int  getCurrentProductId() const;

/* Outgoing — called by defect presenters, posts to q_mqtt_publish */
void enqueueInspection(int product_id, int operator_id,
                       const char* outcome,          // "DEFECT" | "OK"
                       int defect_type_id,           // -1 if OK
                       const char* note);
void publishSessionStart(int product_id, int operator_id);
```

Remove `static const operator_entry_t s_operators[OPERATOR_COUNT]`.
Replace with `operator_entry_t m_operators[APP_OPERATOR_LIST_MAX]` and
`int m_operatorCount`.

### Step 2 — Fill in the presenter TODOs

**`defects_pmpPresenter.cpp` and `defects_injPresenter.cpp`** — identical
pattern for both categories:

```cpp
void defects_pmpPresenter::logDefectInspection(int defectTypeId, const char* note)
{
    model->incrementSessionDefectCount();
    model->enqueueInspection(
        model->getCurrentProductId(),
        model->getOperator(model->getCurrentOperatorIdx()).id,
        "DEFECT", defectTypeId, note);
}

void defects_pmpPresenter::logOkInspection()
{
    model->enqueueInspection(
        model->getCurrentProductId(),
        model->getOperator(model->getCurrentOperatorIdx()).id,
        "OK", -1, "");
}
```

**`productRefPresenter.cpp`:**
- `activate()`: call `view.setProductCount(model->getProductCount())` so
  the scroll list shows the real number of rows.
- Add `void onProductSelected(int idx)`: called by View on row tap;
  stores `model->setCurrentProductId(model->getProduct(idx).id)` then
  publishes session start.

**`productRefView.cpp`:**
- Replace `scrollList1.setNumberOfItems(3)` with
  `scrollList1.setNumberOfItems(presenter->getProductCount())`.
- `scrollList1UpdateItem()`: pass `model->getProduct(itemIndex).name` to
  the container instead of a raw index.
- Wire a row-tap callback that calls `presenter->onProductSelected(idx)`.

### Step 3 — Wire defect button labels to product config

Currently the 8 defect buttons per screen use static `TypedText` strings
baked into the TouchGFX designer. To make them dynamic:

For each defect screen in `setupScreen()`:
```cpp
int count = 0;
const Model::defect_type_t* types =
    model->getDefectTypes(model->getCurrentProductId(), CATEGORY_PMP, &count);
for (int i = 0; i < count && i < DEFECT_COUNT; ++i)
    // set button label via TextAreaWithOneWildcard overlay (same technique
    // as the préciser display — add m_labelBuf[DEFECT_COUNT][25] in the View)
```

This is the most effort. For PoC it is acceptable to keep static labels
and just map by position (button 1 = defect_type_id 1 for that product).
Decide before starting this step.

### Step 4 — mqtt_task → Model bridge (incoming config)

`Application/mqtt/mqtt_task.c` parses retained payloads and must call
into Model. Because Model is a C++ object and mqtt_task is C, expose a
thin C shim:

```c
/* Application/domain/ui_data_bridge.h */
void ui_bridge_set_operators(const operator_entry_t* list, int count);
void ui_bridge_set_products(const product_entry_t* list, int count);
void ui_bridge_set_defect_types(int product_id, int category,
                                const defect_type_t* list, int count);
```

Implement in a `.cpp` file that includes `Model.hpp` and calls the
singleton model. Gate each call with a FreeRTOS mutex (1-ms timeout;
skip update if UI is mid-render — the next retained message will retry).

In `mqtt_task.c`, after parsing:
- `qc/config/operators` payload → `ui_bridge_set_operators(...)` +
  `xEventGroupSetBits(app_events, EVT_OPERATORS_UPDATED)`
- `qc/config/products` payload → `ui_bridge_set_products(...)` +
  `ui_bridge_set_defect_types(...)` +
  `xEventGroupSetBits(app_events, EVT_CONFIG_UPDATED)`

### Step 5 — Model → mqtt_task bridge (outgoing events)

`Model::enqueueInspection()` posts a struct to `q_mqtt_publish`:

```c
typedef struct {
    uint8_t  schema_version; /* = 3 (ADR-014) */
    char     outcome[8];     /* "DEFECT" or "OK" */
    int      product_id;
    int      operator_id;
    int      defect_type_id; /* -1 if OK */
    char     note[128];
} mqtt_inspection_msg_t;
```

`mqtt_task.c` drains `q_mqtt_publish`, serializes to JSON, publishes to
`qc/device/{id}/inspection` (QoS 1). On failure: `defect_queue` write
(Octo-SPI circular buffer), drained by `queue_task` on reconnect.

`Model::publishSessionStart()` posts a similar struct for
`qc/device/{id}/session`.

### Step 6 — Connection status indicator

`Model::tick()` is called every TouchGFX frame. Add:
```cpp
bool isConnected() const; // returns true if EVT_MQTT_CONNECTED bit is set
```
Each `Presenter::activate()` should register a `modelListener` callback
so the View can refresh the Wi-Fi icon when connectivity changes. All
screens must show this indicator (required by Wi-Fi operational notes
above).

---

### Integration order

1. Expand `Model` (Step 1) — no UI change, all compile-time safe.
2. Fill in presenter TODOs (Step 2) — purely internal, no MQTT yet.
3. Wire `q_mqtt_publish` in `mqtt_task` (Step 5) — sends events once
   mqtt_task exists.
4. Wire incoming config (Step 4) — operators and products flow in.
5. Wire product list to scroll UI (Step 3 + productRef presenter).
6. Add connection indicator (Step 6).
7. Dynamic defect button labels (Step 3 optional) — last, after all
   the above is proven.

## Useful debug commands

- ST-Link CLI flash: `STM32_Programmer_CLI -c port=SWD -w PaintingQC.elf -rst`
- Live SWO log capture: `STM32_Programmer_CLI -c port=SWD -SWV portb=2000000`
- Host tests: `cd firmware/tests && make && ./run_tests`
- Wi-Fi module firmware check: `ATCMD test program` from STM32CubeH7 examples
