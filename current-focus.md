# Skill Manager Current Focus

This file is the current execution-focus document for `skill-manager`.

Use it to answer:

- what the product already is
- what work is currently in focus
- what quality bar changes must meet

Do not use this file as a historical milestone log. The old phase-based plan is intentionally retired because the repo has already moved past its earlier read-only/bootstrap framing.

## Current Product Baseline

`skill-manager` is a local-first control plane for skills across multiple agent harnesses.

Current shape:

- Python owns domain logic, the shared store, harness adapters, source connectors, the local API, and the launcher.
- React/Vite owns the browser UI.
- The browser UI is the primary product surface.
- The CLI only launches the local app and browser.

Current product capabilities:

- detect supported harnesses
- scan and merge skills into one unified catalog
- distinguish `shared`, `unmanaged`, and `builtin` entries
- enable and disable shared skills per harness
- centralize unmanaged skills into the shared store
- search external registries
- install source-backed skills into the shared store
- update source-backed shared skills
- report health and integrity state

Current supported harness surface:

- Codex
- Claude
- Cursor
- OpenCode
- OpenClaw
- Gemini

## Current Work Streams

The active focus is not “finish the next phase.” The active focus is improving the product that already exists.

### 1. Frontend Redesign

Priorities:

- make the browser UI feel like the real product, not a bootstrap console
- improve clarity of the multi-page information architecture
- tighten navigation, empty states, status communication, and action affordances
- reduce visual and interaction debt carried over from the initial bootstrap

Working rule:

- prefer improving the primary user flow in the browser over expanding launcher or terminal affordances

### 2. Business Logic Refinement

Priorities:

- tighten catalog semantics and conflict handling
- simplify and harden centralize, enable/disable, install, and update flows
- keep harness-specific behavior isolated in adapters instead of leaking into the application layer or UI
- remove stale read-only/bootstrap assumptions from product behavior and repo messaging

Working rule:

- prefer correctness, predictability, and clearer product semantics over adding more source connectors or one-off features

### 3. Documentation Alignment

Priorities:

- keep repo docs aligned with the actual product baseline
- keep `design.md` architectural and conceptual
- keep this file focused on current execution priorities and validation expectations
- avoid reintroducing historical milestone docs that immediately drift out of date

## Source Of Truth Split

Use the repo docs with this split:

- `design.md`: product architecture, conceptual model, module boundaries, and durable product rules
- `current-focus.md`: current priorities, active work streams, and validation expectations

If a change alters the product model, update `design.md` first.

If a change alters current priorities, expected polish level, or validation requirements, update `current-focus.md`.

## Validation Bar

Changes should be validated in the smallest lane that proves the change, but the validation must match the area touched.

### Backend or application logic changes

- targeted Python unit or integration tests
- broader Python regression coverage when shared catalog or mutation flows change

### Frontend changes

- targeted Vitest coverage when rendering, routing, or client state behavior changes
- frontend build must stay green

### End-to-end flow changes

- Playwright smoke when a user-visible flow changes materially
- fake-home or sandboxed execution remains the default proof lane

### Real-machine validation

- optional and selective
- use only when isolated test lanes are insufficient to confirm harness-specific behavior
- do not make destructive changes to the maintainer machine a routine requirement

## Decision Rules

- Prefer product polish over milestone theater.
- Prefer one coherent browser workflow over fragmented utility surfaces.
- Prefer shared-store and catalog correctness over clever adapter shortcuts.
- Prefer removing stale framing over preserving outdated planning artifacts.
- Prefer small, test-backed refinements over broad speculative roadmap expansion.
