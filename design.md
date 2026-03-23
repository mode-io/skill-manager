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

## Module Model

| Module | Responsibility | Knows About |
|---|---|---|
| `frontend` | User interactions, views, action triggers, optimistic refresh | API shapes only |
| `api` | Thin local HTTP boundary between frontend and app core | Request/response contracts only |
| `application` | Orchestrates scan, centralize, enable, disable, install, update, check | store, harnesses, sources, domain |
| `domain` | Skill concepts, identity, validation, grouping, dedupe rules | nothing external |
| `store` | Canonical shared skill store and manifest | domain models only |
| `harness adapters` | Detect, scan, enable, disable per harness | domain models only |
| `source connectors` | Search/fetch/update from GitHub and other registries | domain models only |

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

## Collaboration Protocol

This is the skeleton of how modules collaborate.

`scan`
- Each harness adapter reports discovered skills and built-ins.
- The store reports all shared packages.
- The application merges them into one `CatalogEntry` list.
- The frontend renders the unified catalog.

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
- The frontend chooses a source.
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

Core screens:

- `Catalog`: all skills, grouped by ownership and source
- `Skill detail`: metadata, source, revision, enabled harnesses
- `Centralize dialog`: one-click conversion of unmanaged skills into shared skills
- `Install dialog`: search or paste a source
- `Updates view`: shared skills with available newer revisions
- `Harnesses view`: detected harnesses and whether they are manageable

## Opinionated Defaults

To keep the product simple:

- Global/user-level skills only in v1
- Built-ins are visible but never moved into the shared store
- `enabled` only means active for that harness
- The shared store owns full skill folders
- Source-qualified identity is required
- The frontend is the primary UX
- The CLI remains only a launcher

If you want, I can now turn this into the next layer down: a precise conceptual spec for the actual data contracts between `application`, `store`, `harness adapters`, and `source connectors`, still without dropping into file/function implementation.
