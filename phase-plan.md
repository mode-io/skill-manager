# Skill Manager Concrete Phase Plan

## Summary

- Build this as `Python + React`: Python owns domain logic, store, harness adapters, local API, and launcher; React/Vite owns the browser UI.
- Use isolated fake-home testing as the primary development environment. Do not depend on your current customized macOS setup during normal development.
- The first usable milestone is read-only: detect harnesses, scan skills, build the unified catalog, and run integrity checks. Mutation flows come later.
- Treat your real machine as the last validation lane only, after isolated tests and fake-home integration are already stable.

## Current Delivered Baseline

- The read-only bootstrap milestone is now implemented:
  - split backend seams for `domain`, `store`, `harness`, `application`, `api`, and `launcher`
  - read-only endpoints for `GET /health`, `GET /harnesses`, `GET /catalog`, `GET /catalog/{skill_ref}`, and `GET /check`
  - deterministic fake-home unit/integration coverage plus browser-level sandbox smoke
- The current merge model is explicit and test-backed:
  - identical unmanaged copies can collapse into one logical entry
  - shared and unmanaged ownership remain separate
  - divergent source-backed copies surface a visible conflict
  - built-ins stay separate from store-owned or unmanaged packages
- Workflow-owned smoke remains intentionally thin in this milestone:
  - `project_skills/skill-manager-smoke` provides `selftest` plus monitored manual acceptance
  - expanded workflow-owned live-smoke automation is deferred until mutation flows or recurring host-specific discovery issues justify it

## Key Changes

### Phase 1: Runtime and Test Harness Foundation

- Create the Python application skeleton with explicit layers: `domain`, `store`, `harness`, `source`, `application`, `api`, `launcher`.
- Create the frontend shell with React/Vite, but keep it UI-only until the local API exists.
- Add a `CommandRunner` abstraction for all harness CLI calls so tests can stub Gemini/OpenClaw/native commands.
- Add a fake-home integration harness that can boot the app against a temporary `HOME`, `XDG_CONFIG_HOME`, and any harness-specific config env vars.
- Add fixture builders for filesystem-based harness layouts and stub command outputs for CLI-driven harnesses.
- Acceptance gate: the app can start in a fake environment, enumerate zero or mocked harnesses, and all tests run without touching the real machine config.

### Phase 2: Domain, Store, and Discovery Model

- Implement the core models: `SkillPackage`, `SkillRef`, `SkillRevision`, `CatalogEntry`, `HarnessBinding`, `BuiltinEntry`.
- Implement full-folder skill parsing and content fingerprinting; do not treat `SKILL.md` alone as the unit of storage.
- Implement the store model and manifest for shared packages, but keep it read-only in this phase.
- Implement catalog merge rules:
  - identical content found in multiple places collapses into one logical package
  - same name from different sources remains separate logical skills
  - built-ins remain visible but store-owned=false
- Define the application read models returned to the frontend: `HarnessSummary`, `CatalogEntryView`, `CatalogGroupView`, `CheckReport`.
- Acceptance gate: the application can build a correct unified catalog from fake store data plus fake harness discoveries.

### Phase 3: Read-Only Harness Adapters and First Usable Product

- Implement read-only adapter behavior for all target harnesses:
  - detect installation
  - discover user/global skills
  - discover built-ins when supported
  - report current binding/status without changing anything
- Keep adapter mutation methods stubbed or unimplemented until the read-only lane is stable.
- Build the first local API for:
  - `GET /health`
  - `GET /harnesses`
  - `GET /catalog`
  - `GET /catalog/{skill_ref}`
  - `GET /check`
- Build the first frontend screens:
  - catalog
  - harnesses
  - check/health
  - skill detail (read-only)
- Ship the CLI launcher that starts the Python app and opens the browser.
- Acceptance gate: on a fake home, the product can launch from one command and display an accurate read-only catalog and health view.

### Phase 4: Enable/Disable Mutation Lane

- Implement the first mutation flow only after the read-only milestone is green.
- Add adapter mutation support for `enable` and `disable`, using harness-native behavior where appropriate and filesystem/config behavior where needed.
- Extend the application layer with idempotent toggle operations and post-action rescan.
- Extend the local API with:
  - `POST /skills/{skill_ref}/enable`
  - `POST /skills/{skill_ref}/disable`
- Extend the frontend with harness toggle actions, pending state, success/failure feedback, and post-action refresh.
- Keep the product rule simple: only `enabled` and `disabled` are user-facing binding states.
- Acceptance gate: in the fake-home harness, all supported adapters can toggle bindings and the catalog reflects the result after rescan.

### Phase 5: Centralize Flow

- Implement store ingest and managed shared copies for non-built-in skills.
- Implement the application `centralize` operation:
  - find eligible unmanaged skills
  - ingest them into the shared store
  - rebind supported harnesses to the shared package
  - rebuild the catalog
- Add API and frontend support for centralization:
  - plan/preview payload returned by API
  - one-click execution from the UI
  - post-action catalog refresh
- Keep built-ins observe-only and never move them into the shared store.
- Acceptance gate: duplicate unmanaged discoveries in the fake environment collapse into shared store ownership without breaking harness visibility.

### Phase 6: Install and Update Sources

- Implement the first source connectors only after centralization works:
  - local path
  - GitHub
  - generic git URL
- Add source metadata to the store so updates are traceable and repeatable.
- Implement install/update application flows and expose them through API + frontend.
- Add install and updates views in the UI.
- Acceptance gate: a skill can be fetched from a supported source into the shared store and later updated in the fake environment without losing existing bindings.

### Phase 7: Real-Machine Smoke Lane

- This phase is intentionally deferred for now.
- The current workflow-owned smoke system is enough for the read-only milestone:
  - repo-native tests own correctness
  - fake-home browser smoke owns sandboxed end-to-end coverage
  - `skill-manager-smoke monitor` remains an optional manual acceptance lane
- Add a manual smoke checklist for your real Mac, but only after the isolated lanes are stable.
- Restrict this lane to explicit manual verification:
  - launcher opens the UI
  - harness detection is correct
  - read-only catalog matches reality
  - a limited enable/disable path works on a selected safe test skill
- Do not require tearing down your special setup. Instead, validate only chosen safe paths and compare expected versus actual behavior.
- Acceptance gate: the product works on your machine without needing destructive normalization of your current config.

## Interfaces

- Current read-only Python-side contracts:
  - `HarnessAdapter`: `scan()`
  - `Store`: `scan()`, `check_integrity()`
  - `ApplicationService`: `health()`, `list_harnesses()`, `list_catalog()`, `get_catalog_detail()`, `run_check()`
- Current stable API contracts:
  - `HarnessSummary[]`
  - `CatalogEntryView[]`
  - `CatalogDetailView`
  - `CheckReport`
- Future mutation-phase contracts are intentionally deferred until enable/disable and centralize work starts.

## Test Plan

- Unit tests:
  - skill folder parsing and fingerprinting
  - source-qualified identity generation
  - same-name/different-source grouping
  - store manifest read/write and integrity checks
- Adapter tests:
  - filesystem harness discovery against temp directories
  - CLI-driven harnesses through stubbed `CommandRunner`
  - built-in discovery stays separate from shared/unmanaged entries
- Application integration tests:
  - scan merges store + harness discoveries correctly
  - read-only catalog endpoint returns stable grouped data
  - enable/disable rescans and updates bindings correctly
  - centralize ingests eligible skills and rebinds supported harnesses
  - install/update keeps source metadata and preserves bindings
- Launcher/UI tests:
  - one command starts the local app and serves the frontend
  - frontend renders empty state, mixed state, and error state correctly
  - frontend mutation actions surface progress and failures clearly
- Manual smoke scenarios:
  - clean fake-home run with no harnesses
  - fake-home run with mixed harness fixtures
  - fake-home run with duplicate names and built-ins
  - explicit final smoke on the real machine without removing custom setup

## Assumptions

- Global/user-level skills only for the first delivery line.
- Built-ins are visible but never centralized.
- The real unit of storage and dedupe is the skill directory, not `SKILL.md` alone.
- The read-only catalog milestone must land before any mutation work.
- Your customized macOS environment is a final compatibility target, not the primary development baseline.
