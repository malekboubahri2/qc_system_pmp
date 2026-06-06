# Andon KPI Board — UI Spec

Display-only wall board on the STM32H7B3I-DK (480×272, TouchGFX 4.x, FreeRTOS),
Wi-Fi via ESP-01 (AT/UART). No input. Decision record: ADR-020.

It shows, at a glance from across the room: live products under inspection,
Taux NC, and trending defects with each one's ratio — with green/orange/red
severity on both products and defects.

## Screen — one Screen, persistent header + auto-rotating body

```
┌──────────────────────────────────────────────────────────────┐
│ ATELIER PEINTURE        TAUX NC         ● MAJ 4s     14:32     │  Header (persistent)
│                          12.4%                                 │
├──────────────────────────────────────────────────────────────┤
│ ░░ body auto-cycles every ~8 s between the two panels ░░       │
│                                                                │
│  Panel A — PRODUITS EN COURS        Panel B — DÉFAUTS FRÉQUENTS│
│  ┌────────┐┌────────┐┌────────┐     Coulure   ████████░░  30%  │
│  │Capot   ││Pare-ch.││Aile AV │     Poussière ██████░░░░  20%  │
│  │ 13.1%  ││  6.2%  ││ 21.0%  │     Bavure    ████░░░░░░  12%  │
│  │260 pcs ││ 90 pcs ││ 45 pcs │     Givrage   ██░░░░░░░░   8%  │
│  └────────┘└────────┘└────────┘                                │
└──────────────────────────────────────────────────────────────┘
```

- Header is always visible. The **body** holds two panels (`panelProducts`,
  `panelDefects`); a timer in the Presenter cross-fades/slides between them
  every ~8 s. No navigation, no input.
- Caps match the firmware arrays and the screen: **≤ 4 product tiles**,
  **≤ 4 defect bars**. The server pre-sorts and truncates.

## Screen states

`Severity { UNKNOWN, GOOD, MODERATE, CRITICAL }` → grey / green / orange / red.
UNKNOWN is the boot/stale value — the board never shows green before it has data.

| State | Trigger | Board shows |
|---|---|---|
| `BOOT` | power-on | loading overlay, values `—`, dot grey, body hidden |
| `CONNECTING` | Wi-Fi/auth in progress | overlay "Connexion au serveur…" |
| `LIVE` | first `/kpi/board` 200 | fade overlay out, fade values in, rotation starts, dot green |
| `STALE` | `updated_at` age > ~2 polls | values kept, dot orange, tiles dimmed |
| `OFFLINE` | link or auth lost | dot red, body dimmed |

## Element list (TouchGFX widget types)

Color-driven elements are set **in code** (Presenter → View setter); Designer
only sets static/neutral colors. Build `ProductTile` and `DefectBar` once as
**Custom Containers**, then place fixed instances.

### Header (persistent)
| Element | Purpose | Widget | Dynamic via | Color-driven |
|---|---|---|---|---|
| `headerBg` | header band | **Box** | — | no |
| `lineName` | "ATELIER PEINTURE" | **TextArea** | — | no |
| `tauxNcLabel` | "TAUX NC" | **TextArea** | — | no |
| `tauxNcValue` | global NC % (hero) | **TextAreaWithOneWildcard** `<> %` | code (snprintf) | **yes — text color** |
| `partsCount` | "427 pcs · 53 NC" | **TextAreaWithTwoWildcards** | code | no |
| `connDot` | online/stale/offline | **Image** (3 bmp) or **Box** | code (swap/setColor) | **yes** |
| `updatedAgo` | "MAJ 4s" | **TextAreaWithOneWildcard** | code | optional |
| `clock` | HH:MM | **TextAreaWithOneWildcard** | code (RTC) | no |

### Body container
| Element | Purpose | Widget |
|---|---|---|
| `bodyArea` | holds the two panels | **Container** |
| `panelProducts` | products panel | **Container** (custom) |
| `panelDefects` | defects panel | **Container** (custom) |

> Rotation = toggle the two panels' visibility on a timer, with a TouchGFX
> container fade (`startFadeAnimation`) or a `MoveAnimator` slide. (No
> stock "swap" widget; it's a Presenter-driven timer.)

### Products panel
| Element | Purpose | Widget | Dynamic via | Color-driven |
|---|---|---|---|---|
| `productsTitle` | "PRODUITS EN COURS" | **TextArea** | — | no |
| `productTile[0..3]` | one product | **Custom Container `ProductTile`** ×4 | code | **yes** |
| — `tileBg` | tile background/tint | **Box** | — | **yes — setColor** |
| — `tileName` | product name | **TextAreaWithOneWildcard** (buffer 20) | code | no |
| — `tileNc` | NC % | **TextAreaWithOneWildcard** `<> %` | code | **yes — text color** |
| — `tileParts` | parts count | **TextAreaWithOneWildcard** `<> pcs` | code | no |
| — `tilePulse` | CRITICAL flash overlay | **Box** + **FadeAnimator** | code | yes |

### Defects panel
| Element | Purpose | Widget | Dynamic via | Color-driven |
|---|---|---|---|---|
| `defectsTitle` | "DÉFAUTS FRÉQUENTS" | **TextArea** | — | no |
| `defectBar[0..3]` | one defect + ratio | **Custom Container `DefectBar`** ×4 | code | **yes** |
| — `barLabel` | defect label | **TextAreaWithOneWildcard** (buffer 28) | code | no |
| — `barTrack` | bar background (100%) | **Box** | — | no |
| — `barFill` | ratio fill (0–100%) | **Box** (width tweened in code) | code | **yes — setColor** |
| — `barPct` | ratio % | **TextAreaWithOneWildcard** `<> %` | code | **yes — text color** |
| — `barPulse` | CRITICAL flash overlay | **Box** + **FadeAnimator** | code | yes |

### Boot / overlay
| Element | Purpose | Widget |
|---|---|---|
| `screenBg` | base background | **Box** (flat) |
| `loadingOverlay` | boot/connect cover | **Container** |
| `loadingText` | "Connexion au serveur…" | **TextArea** (or 1-wildcard animated "…") |
| `loadingPulse` | liveliness (no sprite) | **Box** + **FadeAnimator** |

## Animations (signal, not decoration)

Idle stays static; motion marks change. Keep each ~300–500 ms (~18–30 ticks).
DMA2D (Chrom-ART) makes box/text fades cheap; **no TextureMapper/Canvas** in
steady state.

| What | When | Mechanism |
|---|---|---|
| KPI number roll | value changes | tick-interpolate the int in `handleTickEvent` + `snprintf` |
| Bar fill tween | ratio changes | tick-interpolate `barFill` Box width + `EasingEquations` |
| Value/tile fade-in | BOOT → LIVE | **FadeAnimator** on value containers |
| Overlay fade-out | leaving BOOT | `loadingOverlay.startFadeAnimation()` |
| Pulse on CRITICAL | tile/bar turns red | `tilePulse`/`barPulse` Box + **FadeAnimator** (a few cycles, then stop) |
| Panel swap | rotation timer | container fade or `MoveAnimator` slide |

## Auto-auth (no login)

Provisioned **`station`** credential (long-lived token or user/pass) in
Octo-SPI flash — never in source. Boot: load config (Wi-Fi + server URL + creds)
→ ESP-01 joins Wi-Fi → if user/pass, `POST /auth/login` once and cache the JWT
→ poll `GET /kpi/board` with `Authorization: Bearer …`. On `401`, re-auth (or
mark OFFLINE if token-only). `provision-device.sh` mints the credential.

## Data contract — `GET /kpi/board`

Threshold-agnostic (raw rates; the firmware applies its configured thresholds →
severity). Bounded: `products` ≤ 4, `defects` ≤ 4, server pre-sorted/truncated.

```json
{
  "updated_at": "2026-06-06T14:32:00Z",
  "date": "2026-06-06",
  "nc_rate": 0.124, "inspected_parts": 427, "nc_parts": 53, "ok_parts": 374,
  "products": [
    { "name": "Capot moteur", "parts": 260, "nc_rate": 0.131 }
  ],
  "defects": [
    { "label": "Coulure", "count": 22, "ratio": 0.30 }
  ]
}
```

Same JSON is the body of the retained `qc/display/kpi` MQTT message (optional
transport; HTTP poll is the default).

## Firmware notes (Model / no-alloc)

- **Model (fixed):** integer percents ×10 (`131` = 13.1 %) → format with
  `Unicode::snprintf`, no floats. Fixed `products[4]`, `defects[4]` + counts,
  a `Severity` per item computed once on data update, and a `Conn`/screen state.
- **Severity thresholds in config** (Octo-SPI), defaults per ADR-020: NC rate
  5 %/10 %, defect share 20 %/35 %. Not hardcoded.
- **Wildcard buffers:** product name 20, defect label 28 (data model caps label
  ≤ 24), numbers 8. The `<>` wildcard in Designer reserves these.
- **Fonts (TypedText):** XL ~64 px (global %), L ~26 px (tile %), M ~18 px
  (names/labels), S ~13 px (captions/parts/status). Dynamic name/label fonts
  **must include the full French glyph set** (Latin-1 + é è ê à â ç î ô ù …) or
  live names show boxes; keep the XL/numeric font to digits + `%` + `.`.
- **Refresh:** poll ~5 s; `updated_at` age drives STALE/OFFLINE. Only invalidate
  widgets whose value changed.
- **MVP separation:** data task writes the Model; `Model::tick` → Presenter →
  View setters. No AT/HTTP and no business logic in the View.
