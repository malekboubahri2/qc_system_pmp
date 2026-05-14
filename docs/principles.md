# Engineering Principles

The full reference for the principles summarized in `CLAUDE.md`. When Claude
Code or a developer needs to understand the *why* behind a rule, this is the
document.

---

## 1. Modularity Over Monoliths

### Why

The painting QC PoC is small today. It will not stay small. New plants,
new defect categories, MES integration, mobile apps for supervisors,
analytics pipelines — all are plausible v2 features. A monolithic codebase
makes every change risky; a modular codebase makes most changes local.

### Definition

A module is a unit of code with:
- **One reason to change** — a coherent responsibility
- **A narrow public interface** — most of its surface is hidden
- **No knowledge of its callers** — it doesn't know who uses it
- **Explicit dependencies** — what it needs is visible, not implicit

### In Python (server)

- One concept per file. `defect_types.py` handles defect types, period.
- Public surface in `__init__.py` or via explicit imports. Implementation
  details in `_helpers.py` (underscore prefix = private).
- Modules grouped by domain concept (defects, operators, devices), not by
  technical layer alone.
- Cross-module: import functions, not internals. Never `from foo._helpers
  import _internal_thing`.

### In TypeScript (dashboard)

- Feature-sliced: one folder per feature with its own UI, hooks, types.
- Each feature has an `index.ts` that defines what's public. Outside code
  imports only from there.
- Shared primitives in `lib/` or `components/shared/`. Generic, no feature
  knowledge.

### In C (firmware)

- One `.c/.h` pair per module. Header declares only what callers need;
  everything else is `static` in the `.c`.
- Modules grouped by layer: `domain/` (pure) → `persistence/`, `net/`,
  `mqtt/` (use platform) → `platform/` (hardware).
- No global variables shared across modules. State exposed via accessors.

### Smell tests

- "If I delete this module, how many things break?" If the answer is
  "everything," it's too central.
- "If I want to swap this for a different implementation, can I?" If no,
  the abstraction leaked.
- "Can I describe this module in one sentence without 'and'?" If no, split it.

---

## 2. Portability Over Environment Coupling

### Why

The same code must run on a laptop (dev), in CI (test), and on a Raspberry
Pi (prod). It must also tolerate a swap from SQLite to PostgreSQL, from
Mosquitto to EMQX, from STM32H7 to STM32U5. Environment coupling makes
each of these a refactor; portability makes them config changes.

### Server & Dashboard

- **Containerize everything deployable.** Docker is the deployment unit.
  Compose describes how containers fit together. The same image runs on
  every environment; only env vars change.
- **No hardcoded paths.** Database paths, log paths, config paths — all
  via env vars with sensible defaults.
- **No hardcoded hosts/IPs.** Service-to-service communication uses
  Docker service names. Host-level binding is configured at the compose
  layer.
- **No filesystem assumptions.** Code reads paths from config, not from
  `/home/pi/...`.

### Firmware

- **Hardware Abstraction Layer (HAL).** All hardware access through
  `platform/`. Application code calls `platform_qspi_read()`, not
  `HAL_QSPI_Read()` directly.
- **Two implementations of `platform`:** one for STM32H7, one for the
  host (Linux/macOS). Domain modules run unchanged on both.
- **Build flags for hardware-specific behavior.** Use macros like
  `APP_TARGET_STM32H7` and `APP_TARGET_HOST` to switch implementations
  at compile time.
- **Endianness, alignment, sizes — assume nothing.** Use `<stdint.h>`
  types, check struct packing, never cast pointers to differently-aligned
  types.

### Tests of portability

- Server: does the test suite pass on a laptop with `pytest` and inside
  the dev compose stack with `docker compose run server pytest`? Both
  must work.
- Firmware: does `cd firmware/tests && make && ./run_tests` work on a
  fresh Linux box with no STM32 toolchain installed? It should — that
  proves the domain layer doesn't leak into platform.

---

## 3. Reusability Through Clear Contracts

### Why

The dashboard, server, and firmware are three separate codebases. They
communicate via REST and MQTT. Those interfaces are contracts: change them
incompatibly and something breaks somewhere far away.

### Contract Rules

- **Versioned schemas.** Every MQTT payload has `schema_version`. Every
  REST endpoint is implicitly v1 (`/api/...`); a v2 lives at `/api/v2/...`,
  not as an in-place change.
- **Backward compatibility within a major version.** Add fields, don't
  remove them. Mark old fields deprecated for one release before removal.
- **Schemas are documented.** `docs/api-spec.md` for REST,
  `docs/mqtt-topics.md` for MQTT. Both reference the canonical Pydantic /
  jsmn parser as the source of truth.
- **Generated types where possible.** Dashboard types mirror server
  Pydantic models. Consider OpenAPI codegen if drift becomes a problem.

### Reusable Primitives

Inside each component, build generic primitives that future features can
use:

- Server: a generic CRUD service base class is fine *if* it doesn't fight
  the domain. Don't force everything into it.
- Dashboard: a generic table component with sorting and filtering is
  reusable across log, operator, and device pages.
- Firmware: a generic circular-buffer-in-flash module is reusable for
  defect queue, audit log, and any future telemetry.

But: don't build a reusable primitive on first use. Build the concrete
thing; extract the primitive on the second use; perfect it on the third.

---

## 4. Future-Readiness via Feature Flags & Build Flags

### Why

The PoC will inform v2. Some features will be cut, others changed, some
added. Making behavior toggleable from day one means the v2 design has
options the PoC didn't paint us into a corner over.

### The Three Layers

| Layer | When it changes | Where it lives | Cost to flip |
|---|---|---|---|
| Build-time | Per build/image | C macros, Vite env vars, Dockerfile ARGs | Rebuild |
| Runtime config | Per deployment | Env vars, config files, settings table | Restart |
| Live flag | At any time | DB-backed (server), MQTT-pushed (firmware) | Seconds |

### Picking the right layer

Ask: how fast might I need to flip this?

- **Never after compile** (e.g., target hardware): build-time
- **Per environment** (e.g., MQTT TLS on/off): runtime config
- **For experimentation, gradual rollout, or kill switches**: live flag

When in doubt, choose the cheaper layer. A live flag costs more to build
but is cheaper to use; a build flag costs less to build but more to flip.

### Hygiene

- **Every flag is documented** in `docs/feature-flags.md`: name, layer,
  default, purpose, removal criteria.
- **Flags have an expiration plan.** "Permanent" flags become config.
  Experimental flags get removed once the experiment concludes.
- **No flag without a default.** Code must compile and run with all flags
  at default. Undefined flags = compile error in C, type error in TS,
  runtime error in Python.
- **Flag count is monitored.** More than ~20 flags total is a code smell.
  Audit quarterly.

### In C (firmware)

```c
/* Always use #if, not #ifdef. Forces the macro to be defined. */
#if APP_FEATURE_MQTT_TLS
  #include "mbedtls/ssl.h"
  // ...
#else
  // cleartext path
#endif
```

Pass overrides at build:
```
arm-none-eabi-gcc -DAPP_FEATURE_MQTT_TLS=1 ...
```

Or in CubeIDE: Project Properties → C/C++ Build → Settings → Preprocessor.

### In Python (server)

```python
# Runtime config
if settings.enable_mqtt_tls:
    ...

# Live flag
if feature_flags.is_enabled("new_analytics_view", default=False):
    ...
```

### In TypeScript (dashboard)

```tsx
const showNewView = useFlag("new_analytics_view");
return showNewView ? <NewView /> : <OldView />;
```

---

## 5. Idiomatic for the Platform

### Why

Forcing Java-style OOP into Python or React-style components into
embedded C is how you get unmaintainable code. Each platform has
conventions that exist for good reasons.

### Idioms we follow

**Python (server):**
- Functions, not classes, unless state is involved
- Type hints everywhere (`from __future__ import annotations` if needed)
- Dataclasses or Pydantic models, not dict-passing
- Context managers for resources
- `pathlib.Path`, not `os.path`
- f-strings, not `.format()` or `%`

**TypeScript (dashboard):**
- Functional components, hooks
- `type` for shapes, `interface` only when extending
- No `any` without a `// FIXME` comment
- Discriminated unions for state machines
- Async/await, not Promise chains

**C (firmware):**
- C11 features welcome (designated initializers, `static_assert`,
  anonymous structs, etc.)
- `static` for everything not in the header
- `const` everything you can
- No function-like macros where an `inline` function would do
- Fixed-size types from `<stdint.h>`, never raw `int` for protocol fields

### Anti-idioms we reject

- Singletons in Python ("global state with extra steps")
- Redux for trivial dashboard state (TanStack Query suffices)
- C++ in firmware outside TouchGFX (no need, increases footprint)
- Building our own ORM, framework, or async runtime

---

## How These Principles Interact

The principles reinforce each other:
- **Modularity** makes **portability** easier (swap out a module)
- **Portability** makes **testability** easier (run domain on host)
- **Testability** makes **refactoring** safer
- **Refactoring** is what keeps **modularity** intact long-term
- **Feature flags** let us land incomplete work without breaking modularity
- **Containerization** is portability and modularity at the deployment level

If you find yourself violating one principle to satisfy another, stop and
discuss. There's almost always a third option.

---

## When to Break the Rules

Principles are not laws. Break them when:

- The cost of following exceeds the benefit (e.g., one tiny stateless
  function in a class — leave it)
- A short-term hack unblocks a critical demo (but log technical debt in
  `TODO.md` and fix within the sprint)
- The principle leads to obvious worse code (rare, but it happens —
  pragmatism over dogma)

But: never break them silently. A broken rule is a documented decision,
not an accident. Add an ADR to `docs/decisions.md` explaining what and why.
