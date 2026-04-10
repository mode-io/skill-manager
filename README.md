# skill-manager

`skill-manager` is a local-first control plane for discovering, previewing, managing, and installing agent skills across multiple harnesses from one interface.

It combines a FastAPI backend with a React/Vite frontend to give you a unified workspace for:

- auditing what skills exist on your machine
- bringing unmanaged skills under a shared managed store
- enabling or disabling managed skills per harness
- previewing source-backed skills from `skills.sh`
- updating, unmanaging, or deleting managed skills safely

## What skill-manager does

- Scans local skill directories across supported harnesses and groups matching skill packages into one inventory.
- Distinguishes managed, unmanaged, custom, and built-in skills in a single workspace.
- Lets you bring local unmanaged skills under a shared managed store.
- Lets you toggle managed skills on or off per harness.
- Lets you stop managing a skill, delete a managed skill, or update it from source when supported.
- Lets you browse a marketplace overlay backed by `skills.sh` and install source-backed skills into the managed store.

## Core workflows

### Skills workspace

The `Skills` surface is split into:

- `Managed`: skills already under the shared managed store
- `Unmanaged`: local skill copies discovered in harness directories but not yet managed

Opening a skill shows a detail panel or mobile drawer with:

- source links
- harness access state
- local locations
- `SKILL.md` content when available
- management actions such as update, stop-managing, or delete

### Marketplace

The `Marketplace` surface is browse-first:

- leaderboard and search are backed by `skills.sh`
- clicking a card opens an overlay preview instead of shifting the main page
- install actions stay on the marketplace page and switch to `Open in Skills` after installation

## Supported harnesses

| Harness | Discovery model | Notes |
| --- | --- | --- |
| Codex | Filesystem-backed | User and optional global skill roots |
| Claude | Filesystem-backed | User and optional global skill roots |
| Cursor | Filesystem-backed | User and optional global skill roots |
| OpenCode | Config-backed | Built-in catalog support |
| OpenClaw | CLI-first with config fallback | First-class harness access; bundled OpenClaw skills stay out of the inventory |

The current detail-page harness matrix treats Codex, Claude, Cursor, OpenCode, and OpenClaw as first-class harnesses.

## Architecture at a glance

- **Frontend:** React 19 + Vite + TanStack Query
- **Backend:** FastAPI served through `python -m skill_manager`
- **Inventory model:** shared-store scan + per-harness scans merged into one read model
- **Marketplace model:** `skills.sh` catalog + GitHub-backed source resolution
- **Storage:** shared managed packages are stored under XDG data and linked into harness roots as needed

## Safety and local data

`skill-manager` is a local desktop-style tool. It reads from, and can mutate, local harness skill directories on your machine.

Operations that change local state include:

- `Bring Under Management`
- enable / disable for managed harness links
- `Update From Source`
- `Stop Managing`
- `Delete Skill`
- marketplace installs into the shared managed store

If you use this on a real workstation, treat it like any other local configuration management tool: point it at the correct skill roots, understand what is managed vs unmanaged, and review destructive actions before confirming them.

## Installation

### Public install channels

`skill-manager` is released under the MIT License. See [`LICENSE`](LICENSE).

The public install contract is designed around:

- npm
- Homebrew via a custom Mode IO tap

On tagged public releases, the installed user flow is:

```bash
npm install -g skill-manager
skill-manager
```

The Homebrew formula is generated from the same release artifacts. The exact tap command will be documented once the public tap is live.

On macOS, the very first launch of an unsigned release artifact can be noticeably slower because the system performs first-run verification on that binary path. Subsequent launches are much faster.

### Installed CLI

The installed command surface is:

```bash
skill-manager
skill-manager serve
skill-manager start
skill-manager stop
skill-manager status
skill-manager --version
```

- `skill-manager` starts the app in the foreground
- `start` launches one managed background instance
- `stop` stops only that managed background instance
- `status` reports the managed background instance if it is running

## Source checkout quickstart

### Requirements

- Python 3.11+
- Node.js 18+
- npm

`skill-manager` supports Python 3.11+. CI currently validates backend compatibility on Python 3.11 through 3.14, while packaging and release builds stay pinned to Python 3.11 for determinism.

### Install dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
npm install
```

### Run from the repo

One-command contributor setup:

```bash
scripts/install-dev.sh
```

One-command local app start:

```bash
scripts/start-dev.sh
```

Stop the managed local instance:

```bash
scripts/stop-dev.sh
```

The traditional split dev flow still exists when you want Vite hot reload:

```bash
npm run dev
npm run dev:backend
```

Default local URLs:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8000`
- Health: `http://127.0.0.1:8000/api/health`

## Configuration

By default, `skill-manager` resolves harness paths from `HOME` and `XDG_CONFIG_HOME`. You can override individual roots with environment variables.

### Codex

- `SKILL_MANAGER_CODEX_ROOT`
- `SKILL_MANAGER_CODEX_GLOBAL_ROOT`

### Claude

- `SKILL_MANAGER_CLAUDE_ROOT`
- `SKILL_MANAGER_CLAUDE_GLOBAL_ROOT`

### Cursor

- `SKILL_MANAGER_CURSOR_ROOT`
- `SKILL_MANAGER_CURSOR_GLOBAL_ROOT`

### OpenCode

- `SKILL_MANAGER_OPENCODE_ROOT`
- `SKILL_MANAGER_OPENCODE_GLOBAL_ROOT`
- `SKILL_MANAGER_OPENCODE_BUILTINS`

### OpenClaw

- `SKILL_MANAGER_OPENCLAW_CONFIG`

These overrides are useful when your harness skill directories or OpenClaw config file live outside the defaults.

## Development

Useful local commands:

```bash
scripts/install-dev.sh
npm run typecheck
bash scripts/test_backend.sh
npm test
npm run build
./.venv/bin/python -m skill_manager serve --host 127.0.0.1 --port 8000 --no-open-browser
scripts/ci_validate.sh
```

Test coverage currently includes:

- frontend unit tests
- backend unit and integration tests
- Playwright smoke coverage

## Community

- See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.
- See [SECURITY.md](SECURITY.md) to report vulnerabilities privately.

## Repository layout

- `frontend/` — React/Vite UI, including `skills` and `marketplace` feature modules
- `skill_manager/` — FastAPI app, read-model logic, mutation services, harness adapters, and source/store integrations
- `tests/` — backend integration fixtures plus unit and integration coverage
- `scripts/` — local validation and fixture-serving utilities

## Packaging note

The root `package.json` remains private because it is the repo-local frontend workspace. The public npm package that installs `skill-manager` lives under `packaging/npm/`.

## Public API surface

The backend serves the frontend build and exposes app APIs under `/api`.

Common endpoints:

- `/api/health`
- `/api/settings`
- `/api/skills`
- `/api/marketplace/popular`

The main frontend routes are:

- `/skills/managed`
- `/skills/unmanaged`
- `/marketplace`

## Current limitations

- This is a local-first app, not a hosted service.
- Source-backed operations are currently centered on GitHub-backed skills.
- Marketplace content is sourced from `skills.sh`.
- Public packaging is macOS-first for the first release pass.
- The first packaged public release is expected to be unsigned / not notarized.

## Project status

This repository is in active development as the public `skill-manager` project, with npm/Homebrew installation support backed by native release artifacts.
