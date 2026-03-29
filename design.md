# Skill Manager Design Scaffold

This file captures the current conceptual logic and model design for the incubating Universal Skill Manager project.

It is parameter scaffolding only. The folder name, repo identity, and design may all change later.

The cleaner framing is: this project needs a product architecture, not an implementation plan.

## Core Shape

`skill-manager` is a local control plane with one entrypoint:

`CLI launcher -> local app server -> browser frontend -> application core -> adapters`

The CLI is not the product surface. It only starts the local app and opens the browser.  
The browser frontend is the product surface.  
The application core is the only place where orchestration logic lives.

The HTTP split is explicit:

- SPA routes live at `/`, `/skills`, `/skills/managed`, `/skills/unmanaged`, and `/marketplace`
- JSON APIs live under `/api/*`

This avoids page/API route collisions and keeps the browser app as the only owner of page navigation.

## Module Model

| Module | Responsibility | Knows About |
|---|---|---|
| `frontend` | User interactions, views, query caching, optimistic UI, session memory | API shapes only |
| `api` | Thin local HTTP boundary between frontend and app core | Request/response contracts only |
| `application` | Orchestrates scan, centralize, enable, disable, install, update, check | store, harnesses, sources, domain |
| `domain` | Skill concepts, identity, validation, grouping, dedupe rules | nothing external |
| `store` | Canonical shared skill store and manifest | domain models only |
| `harness adapters` | Detect, scan, enable, disable per harness | domain models only |
| `source connectors` | Fetch/update from GitHub and ingest marketplace data from `skills.sh` | domain models only |

This keeps the separation simple:

- `domain` defines truth
- `store` owns shared copies
- `harness` exposes skills to tools
- `source` imports new skills
- `application` coordinates all of them
- `frontend` never talks to filesystem or harnesses directly

## Canonical Models

The key conceptual mistake to avoid is treating a skill as a markdown file. The real unit is the whole skill folder.

Use these models:

| Model | Meaning |
|---|---|
| `SkillPackage` | One complete skill directory with parsed `SKILL.md`, supporting files, and a content fingerprint |
| `SkillRef` | Stable logical identity of a skill across scans and updates |
| `SkillRevision` | The current content fingerprint of a specific package version |
| `CatalogEntry` | What the frontend renders: one logical skill plus ownership, source, and per-harness visibility |
| `HarnessBinding` | Whether a skill is enabled for a given harness |
| `BuiltinEntry` | A harness-provided skill that is visible but not owned by the shared store |

The frontend should not receive backend-only ranking or workflow scaffolding fields. The API should expose stable read-model DTOs rather than domain objects or serializer logic embedded in inventory/domain types.

The right identity split is:

- `SkillRef`: stable identity  
  Format conceptually: `source_kind + source_locator + declared_name`
- `SkillRevision`: current package content fingerprint

That solves the name-collision problem cleanly:

- Same name, same source, new content: same `SkillRef`, new `SkillRevision`
- Same name, different source: different `SkillRef`
- Same content discovered in multiple harnesses: one logical package, many sightings

## Catalog Model

The frontend should render one unified catalog with three ownership types:

- `shared`
- `unmanaged`
- `builtin`

And one simple activation model per harness:

- `enabled`
- `disabled`

`builtin` is not an activation state. It is an ownership/type classification.

So the UI logic becomes simple:

- A skill can be shared and enabled in some harnesses
- A skill can be unmanaged and eligible for centralization
- A skill can be builtin and never centralized

## Product Semantics

The browser product should use a simpler user-facing model than the raw internal ownership and observation model.

### User-facing skill states

The product should classify skills into these user-facing states:

- `Managed`
- `Unmanaged`
- `Custom`
- `Built-in`

These states are presentation semantics derived from the underlying catalog and should be produced by the application/read-model layer instead of forcing the frontend to interpret low-level internals.

### Source and customization rules

The catalog should follow these rules:

- same source plus same content means the sightings collapse into one logical skill
- same source plus different content means the modified version becomes a `Custom` skill instead of a first-class conflict
- only unmodified source-backed managed skills are updateable
- custom skills are not updateable from source
- built-ins remain visible but are never centralized

This keeps the product model aligned with user expectations and removes most conflict handling from the default workflow.

The current simplified skills payload intentionally does not surface a separate `needs action` workflow bucket. `Custom` is the only user-facing review state derived from local divergence, and its explanation belongs in the badge/detail surface rather than a dedicated list filter.

## Collaboration Protocol

This is the skeleton of how modules collaborate.

`scan`
- Each harness adapter reports discovered skills and built-ins.
- The store reports all shared packages.
- The application merges them into one `CatalogEntry` list.
- The frontend renders the unified catalog.

Read paths should stay split from mutation paths:

- `SkillsQueryService` builds read models and API DTOs
- `SkillsMutationService` owns enable/disable/manage/update/install mutations
- `SourceFetchService` resolves source-backed fetches
- `MarketplaceService` owns marketplace ingestion, search, and install-token resolution

`centralize`
- The application selects all eligible unmanaged skills.
- The store ingests them as shared `SkillPackage`s.
- The application asks each relevant harness adapter to point to the shared package.
- The application rebuilds the catalog.
- The frontend refreshes to show the new shared state.

`enable / disable`
- The frontend sends `skill_ref + harness`.
- The application resolves the shared package.
- The harness adapter performs the harness-specific activation or deactivation.
- The application rebuilds the catalog.
- The frontend updates the toggle state.

`install`
- The frontend chooses a marketplace entry.
- The application resolves the marketplace install token into a GitHub source descriptor.
- The source connector fetches a `SkillPackage`.
- The store ingests it.
- The application adds it to the catalog.
- Optional harness enablement happens as a separate action.

`update`
- The source connector checks whether a newer revision exists for a shared skill.
- If yes, it fetches the new `SkillPackage`.
- The store replaces the current revision.
- Existing harness bindings are reapplied by the application.
- The catalog refreshes.

Update eligibility rule:

- only unmodified source-backed managed skills should surface as updateable in the user-facing product
- if a managed skill diverges from its original source content, it should be treated as `Custom` instead of remaining a normal update target

`check`
- The store verifies shared package integrity.
- Harness adapters verify current bindings.
- The application returns a simple health report.

## Harness Strategy

Keep the public model uniform, but let adapters differ internally.

- Claude Code: filesystem adapter
- Codex CLI: filesystem adapter
- OpenCode: filesystem/config adapter
- OpenClaw: config-driven adapter, plus builtin catalog awareness
- Gemini CLI: native-command adapter, even if it may also use skill folders internally

The application does not care whether a harness uses symlinks, config mutation, or native CLI commands.  
It only cares that every adapter supports the same conceptual actions.

## Frontend Concept

The frontend should feel like a control panel, not a terminal wrapper.

Client-side data flow should use one consistent pattern:

- React Query owns server state and invalidation
- feature-layer selectors derive UI models from cached API data
- route/session providers own ephemeral UI memory such as tab filters and scroll position
- transport helpers in `api/client.ts` stay thin and stateless

Core screens:

- `Skills`: a primary workspace split into `Managed` and `Unmanaged`
- `Managed`: dense card-row control plane for shared-store skills with per-harness toggles
- `Unmanaged`: intake surface for unmanaged local discoveries with centralization actions
- `Skill detail`: metadata, source summary, updateability, and advanced details when expanded
- `Marketplace`: acquisition surface backed by the `skills.sh` all-time leaderboard and `skills.sh` search
- `Settings`: secondary maintenance surface for harness availability, rescan, source preferences, and diagnostics

## Opinionated Defaults

To keep the product simple:

- Global/user-level skills only in v1
- Built-ins are visible but never moved into the shared store
- `enabled` only means active for that harness
- The shared store owns full skill folders
- Source-qualified identity is required
- The frontend is the primary UX
- The CLI remains only a launcher
- The main user workflow should live on a single `Skills` page
- Advanced operational detail should stay backend-side unless explicitly expanded

If you want, I can now turn this into the next layer down: a precise conceptual spec for the actual data contracts between `application`, `store`, `harness adapters`, and `source connectors`, still without dropping into file/function implementation.
