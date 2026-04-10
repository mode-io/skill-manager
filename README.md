# skill-manager

<p align="center">
  <img src="assets/Skill-Manager-Hero-shadow.svg" alt="skill-manager hero" width="960" />
</p>


<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-111827?style=flat-square" /></a>
  <a href="#from-source"><img alt="Python 3.11+" src="https://img.shields.io/badge/python-3.11%2B-3776AB?style=flat-square&logo=python&logoColor=white" /></a>
  <a href="#install"><img alt="Install with npm" src="https://img.shields.io/badge/install-npm-CB3837?style=flat-square&logo=npm&logoColor=white" /></a>
  <a href="#install"><img alt="macOS" src="https://img.shields.io/badge/platform-macOS-111827?style=flat-square&logo=apple&logoColor=white" /></a>
  <a href="#safety"><img alt="Local-first" src="https://img.shields.io/badge/data-local--first-0F766E?style=flat-square" /></a>
</p>

Manage AI skills across Codex, Claude, Cursor, OpenCode, and OpenClaw from one local app.

If you use more than one agent harness, skills end up scattered across different folders, install flows, and local states. `skill-manager` gives you one place to see what is installed, bring unmanaged skills under control, enable or disable skills per harness, and install new ones safely without turning your local setup into guesswork.

## Why skill-manager exists

- Skills get duplicated across multiple harness folders.
- Local skill copies drift out of sync and become hard to reason about.
- It is easy to lose track of what is managed, unmanaged, built in, or custom.
- Editing local skill directories by hand is risky when you are not sure which tool depends on which copy.

## What you can do

- Discover supported harnesses on your machine automatically.
- See managed and unmanaged skills in one inventory.
- Bring local unmanaged skills under management without losing visibility.
- Enable or disable managed skills per harness.
- Install new skills from the marketplace and open them directly in `Skills`.

## Product tour

<p align="center">
  <img src="assets/Skill-Manager.png" alt="skill-manager managed skills view" width="960" />
</p>

The `Skills` workspace gives you one place to review managed and unmanaged skills, inspect local state, and control harness access.

<p align="center">
  <img src="assets/Skill-Manager-Marketplace.png" alt="skill-manager marketplace view" width="960" />
</p>

The `Marketplace` view lets you browse, preview, and install new skills without leaving the app.

Typical flow:

1. Open `Skills` to see what is already installed across your supported harnesses.
2. Bring an unmanaged skill under management so it becomes part of one shared local inventory.
3. Enable that managed skill only for the harnesses you want.

## Install

`skill-manager` is released under the MIT License. See [LICENSE](LICENSE).

The supported public install paths are npm and Homebrew on macOS. Only the latest released version is supported.

### npm

```bash
npm install -g skill-manager
skill-manager
```

The npm package installs the matching native `skill-manager` release artifact for your macOS architecture during `postinstall`.

On macOS, the first launch of an unsigned release artifact can be noticeably slower while the system performs first-run verification. Later launches are much faster.

### Homebrew

```bash
brew tap mode-io/tap
brew install skill-manager
```

Homebrew installs the same native `skill-manager` release artifacts that back the npm wrapper.

## Quick start

1. Install `skill-manager`.
2. Run `skill-manager`.
3. Open `Skills`.
4. Review the `Unmanaged` list and bring one local skill under management.
5. Open that skill and enable it for the harnesses you want.

Common installed-app commands:

```bash
skill-manager
skill-manager start
skill-manager stop
skill-manager status
```

- `skill-manager` launches the app in the foreground.
- `skill-manager start` launches one managed background instance.
- `skill-manager stop` stops that managed background instance.
- `skill-manager status` shows whether the managed background instance is running.

## Supported harnesses

<table align="center">
  <tr>
    <td align="center" valign="middle">
      <img src="assets/harness-logos/codex-logo.svg" alt="Codex CLI" height="56" /><br />
      <strong>Codex CLI</strong><br />
      <a href="https://developers.openai.com/codex/cli">Docs</a>
    </td>
    <td align="center" valign="middle">
      <img src="assets/harness-logos/claude-code-logo.svg" alt="Claude Code" height="56" /><br />
      <strong>Claude Code</strong><br />
      <a href="https://code.claude.com/docs/en/overview">Docs</a>
    </td>
    <td align="center" valign="middle">
      <img src="assets/harness-logos/cursor-logo.svg" alt="Cursor" height="56" /><br />
      <strong>Cursor</strong><br />
      <a href="https://cursor.com/docs">Docs</a>
    </td>
    <td align="center" valign="middle">
      <img src="assets/harness-logos/opencode-logo.svg" alt="OpenCode" height="56" /><br />
      <strong>OpenCode</strong><br />
      <a href="https://opencode.ai/docs">Docs</a>
    </td>
    <td align="center" valign="middle">
      <img src="assets/harness-logos/openclaw-logo.svg" alt="OpenClaw" height="56" /><br />
      <strong>OpenClaw</strong><br />
      <a href="https://docs.openclaw.ai/start/getting-started">Docs</a>
    </td>
  </tr>
</table>

## Safety

`skill-manager` is a local-first desktop-style tool. It reads from, and can mutate, local harness skill directories on your machine.

Actions that change local state include:

- `Bring Under Management`
- enable or disable for managed harness links
- `Update From Source`
- `Stop Managing`
- `Delete Skill`
- marketplace installs into the managed local inventory

Use it like any other local configuration-management tool: point it at the correct skill roots, understand what is managed versus unmanaged, and review destructive actions before confirming them.

## How it works

Before you bring a skill under management, each harness just points at its own local copy. After you bring that skill under management, `skill-manager` stores one managed copy in its shared local inventory and rewires each supported harness to that shared copy with symlinks. That gives you one canonical package to update, disable, or delete while still controlling harness access individually.

<p align="center">
  <img src="assets/skill_manager_before_after.svg" alt="Before and after skill management flow" width="960" />
</p>

## From source

### Requirements

- Python 3.11+
- Node.js 18+
- npm

`skill-manager` supports Python 3.11+. CI validates backend compatibility on Python 3.11 through 3.14, while packaging and release builds stay pinned to Python 3.11 for determinism.

### Contributor setup

```bash
scripts/install-dev.sh
```

### Run locally

```bash
scripts/start-dev.sh
```

Stop the managed local instance:

```bash
scripts/stop-dev.sh
```

The traditional split dev flow is still available when you want Vite hot reload:

```bash
npm run dev
npm run dev:backend
```

If you stop the local dev app and want to bring it back:

```bash
scripts/start-dev.sh
```

If you are using the split dev flow instead, restart both sides:

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

## Limitations

- This is a local-first app, not a hosted service.
- Source-backed operations are currently centered on GitHub-backed skills.
- Marketplace content is sourced from `skills.sh`.
- Public distribution is currently macOS-only.

## Project status

This repository is in active development as the public `skill-manager` project, with npm and Homebrew distribution backed by native release artifacts.
