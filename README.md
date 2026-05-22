# skill-manager

[中文说明](README.zh-CN.md)

<p align="center">
  <img src="assets/skill_manager_logo.svg" alt="Skill Manager" width="520" />
</p>

<p align="center">
  <strong>A local-first control center for AI extensions.</strong><br />
  Use, review, scan, and discover Skills, MCP servers, slash commands, and CLI tools across agent harnesses.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-111827?style=flat-square" /></a>
  <a href="https://github.com/mode-io/skill-manager/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/mode-io/skill-manager?style=flat-square&color=EA580C" /></a>
  <a href="https://www.npmjs.com/package/@mode-io/skill-manager"><img alt="npm version" src="https://img.shields.io/npm/v/%40mode-io%2Fskill-manager?style=flat-square&logo=npm&logoColor=white" /></a>
  <a href="#install"><img alt="Install with Homebrew" src="https://img.shields.io/badge/install-homebrew-FBBF24?style=flat-square&logo=homebrew&logoColor=111827" /></a>
  <a href="#install"><img alt="macOS ARM64/x64 and Linux x64/ARM64" src="https://img.shields.io/badge/platform-macOS%20ARM64%2Fx64%20%2B%20Linux%20x64%2FARM64-111827?style=flat-square&logo=linux&logoColor=white" /></a>
  <a href="#local-first-safety"><img alt="Local-first" src="https://img.shields.io/badge/data-local--first-0F766E?style=flat-square" /></a>
</p>

![skill-market-overview](./assets/skill-manager-skill-unification.svg)

## Why it exists

AI extensions are scattered across harness-specific folders, MCP config files, slash command locations, and marketplace sources. Skill Manager gives those pieces one local control surface:

| Product idea | What it means |
|---|---|
| **In use** | Skill Manager controls the item and can enable or disable it across harnesses. |
| **Needs review** | Skill Manager found local state, config differences, or inventory issues that need a decision. |
| **Scan** | Run LLM-backed security checks against Skills before trusting them. |
| **Discover** | Browse marketplaces and preview external tools. |

## What you can do

- See what is in use, what needs review, and where extensions are active.
- Adopt local Skills into one shared inventory, then enable or disable them per harness.
- Scan Skills with a saved LLM provider configuration and review findings before use.
- Install or adopt MCP server configs, resolve differences, and enable them where supported.
- Manage reusable slash commands once, then sync them to supported harnesses.
- Discover Skills, MCP servers, and preview-only CLI tools from marketplace sources.

## Product tour

### Overview

Start with the whole extension portfolio: what is in use, what needs review, what can be discovered, and where extensions are active.

![skill-market-overview](./assets/skill-manager-overview.png)

### Skills

Use Skills as shared local packages instead of maintaining separate copies per harness.

Typical flow:

1. Review a Skill found in a harness or install one from the marketplace.
2. Adopt it into the Skill Manager inventory.
3. Enable it only where it should be available.
4. Update, remove, or delete it from one place.

![skill-market-skill-matrxi](./assets/skill-manager-skill-matrix.png)

### Skill scanning

Scan Skills with an LLM-backed security review before you rely on them.

Typical flow:

1. Add and validate an LLM scan configuration.
2. Switch Skills in use to the Scan view.
3. Run a scan for one Skill, selected Skills, or the full visible list.
4. Review severity, findings, snippets, and remediation guidance.

![skill-manager-scan-view](./assets/skill-manager-scan-view.svg)

Scan configurations are managed separately so you can save multiple providers, choose one active configuration, and keep API keys masked in list views.

![skill-manager-scan-config](./assets/skill-manager-scan-config.svg)

### MCP servers

Use MCP servers as one normalized config that can be written into each harness shape.

Typical flow:

1. Review an MCP server found in a harness or install one from the marketplace.
2. Adopt it into the Skill Manager inventory.
3. Enable it where the server should be available.
4. Resolve config differences, disable harness bindings, or uninstall it from one place.

![skill-market-skill-matrxi](./assets/skill-manager-mcp-matrix.png)

### Slash commands

Use slash commands as one shared prompt library instead of rewriting the same command in each harness-specific format.

Typical flow:

1. Create a slash command with a name, description, and prompt.
2. Use `$ARGUMENTS` where runtime input should be inserted.
3. Sync it to supported harnesses.
4. Review existing harness command files and adopt them into the shared library when needed.

![skill-market-slash-commands-matrix](./assets/skill-manager-slash_commands-matrix.png)

### Marketplace

Marketplace is the discovery surface:

- **Skills Marketplace**: browse and install Skills.
- **MCP Marketplace**: browse and install MCP servers.
- **CLI Marketplace**: preview external CLI tools from CLIs.dev. This is display-only; Skill Manager does not install or manage CLIs.

![skill-market-skill-matrxi](./assets/skill-manager-marketplace.png)

## Install

### Homebrew (macOS recommended)

```bash
brew tap mode-io/tap
brew install skill-manager
skill-manager start
```

### npm (macOS ARM64/x64 and Linux x64/ARM64)

```bash
npm install -g @mode-io/skill-manager
skill-manager start
```

The npm wrapper downloads the native release artifact for the current platform and CPU architecture.

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

| Harness | Skills | MCP servers | Slash commands |
|---|---:|---:|---:|
| Codex CLI | Yes | Yes | Yes |
| Claude Code | Yes | Yes | Yes |
| Cursor | Yes | Yes | Yes |
| OpenCode | Yes | Yes | Yes |
| OpenClaw | Yes | Not Yet | Not Yet |

## Local-first safety

Skill Manager is a local configuration-management tool. It runs on your machine and reads or writes local harness extension state.

Actions that can change local state include:

- adopting a local skill folder
- enabling or disabling a skill for a harness
- updating a source-backed skill
- removing or deleting a skill
- creating, updating, validating, activating, or deleting an LLM scan configuration
- running a Skill scan, which sends selected Skill context to the configured LLM provider
- installing an MCP server into a source harness
- adopting an existing MCP config
- enabling, disabling, resolving, or uninstalling an MCP server
- creating, updating, syncing, importing, or deleting a slash command
- changing harness support settings

App-owned files live under `~/Library/Application Support/skill-manager` on macOS and XDG base directories on Linux.

## How it works

### Skills

Before adoption, each harness points at its own local skill folder. After adoption, Skill Manager keeps one canonical package in its shared local store and exposes it to selected harnesses with local links. Disabling a harness removes that harness binding without deleting the package.

![skill-market-overview](./assets/skill-manager-skill-unification.svg)

### Skill scans

Skill scans build a bounded prompt context from `SKILL.md`, manifest metadata, script and config files, and files referenced by the Skill instructions. Secret-bearing files such as `.env`, private keys, certificates, and credential files are excluded from the prompt context, and large files are skipped when they exceed scanner limits.

The scanner uses the active saved LLM configuration first. If none is active, it can fall back to supported environment variables such as `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `AZURE_OPENAI_API_KEY`, `AWS_BEDROCK_MODEL`, or `OLLAMA_HOST`.

Scan reports show whether the Skill is safe, the maximum severity, findings, locations, snippets, and remediation text. The frontend caches completed reports in browser local storage so recent results remain visible after navigation.

### MCP servers

MCP servers are stored as normalized Skill Manager records, then translated into the config shape each harness expects:

- Codex uses TOML under `mcp_servers`.
- Claude Code and Cursor use `mcpServers` JSON entries.
- OpenCode uses typed local/remote MCP entries.
- OpenClaw MCP writes are not yet supported.

When Skill Manager finds different configs for the same MCP server, it asks you to resolve the source of truth first.

![skill-market-overview](./assets/skill-manager-mcp-translation.svg)

### Slash commands

Slash commands are stored as TOML records under Skill Manager app storage, then rendered into each supported harness format:

- OpenCode writes Markdown command files under `~/.config/opencode/commands` and invokes them with `/`.
- Claude Code writes Markdown command files under `~/.claude/commands` and invokes them with `/`.
- Cursor writes plain text command files under `~/.cursor/commands` and invokes them with `/`.
- Codex writes prompt files under `~/.codex/prompts` and invokes them with `/prompts:`.
- OpenClaw slash command writes are not yet supported.

Skill Manager tracks target ownership with sync state and content hashes. It will not overwrite an untracked command file automatically, and it reports managed files as changed or missing when the target no longer matches the last synced hash. Review actions let you adopt unmanaged commands, restore managed content, adopt a changed harness command as the new source, or remove a broken binding while leaving the harness file untouched.

### CLIs

CLI marketplace entries are preview-only.

## Configuration

On macOS, app-owned files live under `~/Library/Application Support/skill-manager`. On Linux, app-owned files use XDG base directories.

Useful macOS paths:

- shared skills store: `~/Library/Application Support/skill-manager/shared`
- MCP manifest: `~/Library/Application Support/skill-manager/mcp/manifest.json`
- slash command library: `~/Library/Application Support/skill-manager/slash-commands/commands`
- slash command sync state: `~/Library/Application Support/skill-manager/slash-commands/sync-state.json`
- marketplace cache: `~/Library/Application Support/skill-manager/marketplace`
- app database and LLM scan configs: `~/Library/Application Support/skill-manager/skill-manager.db`
- app settings: `~/Library/Application Support/skill-manager/settings.json`

Useful Linux paths:

- shared skills store: `${XDG_DATA_HOME:-~/.local/share}/skill-manager/shared`
- MCP manifest: `${XDG_DATA_HOME:-~/.local/share}/skill-manager/mcp/manifest.json`
- slash command library: `${XDG_DATA_HOME:-~/.local/share}/skill-manager/slash-commands/commands`
- slash command sync state: `${XDG_DATA_HOME:-~/.local/share}/skill-manager/slash-commands/sync-state.json`
- marketplace cache: `${XDG_DATA_HOME:-~/.local/share}/skill-manager/marketplace`
- app database and LLM scan configs: `${XDG_DATA_HOME:-~/.local/share}/skill-manager/skill-manager.db`
- app settings: `${XDG_CONFIG_HOME:-~/.config}/skill-manager/settings.json`

Most users do not need to change these locations. If you manage skills in a custom environment, you can override individual skill roots with environment variables.

| Harness | Env var | Default Skill Manager skill root |
|---|---|---|
| Codex | `SKILL_MANAGER_CODEX_ROOT` | `~/.agents/skills` |
| Claude | `SKILL_MANAGER_CLAUDE_ROOT` | `~/.claude/skills` |
| Cursor | `SKILL_MANAGER_CURSOR_ROOT` | `~/.cursor/skills` |
| OpenCode | `SKILL_MANAGER_OPENCODE_ROOT` | `~/.config/opencode/skills` |
| OpenClaw | `n/a` | `~/.openclaw/skills` |

MCP config locations are harness-owned. Skill Manager writes only to verified config paths and skips unsupported harness writes.

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

The split dev flow is available when you want Vite hot reload:

```bash
npm run dev
npm run dev:backend
```

Default local URLs:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8000`
- Health: `http://127.0.0.1:8000/api/health`

Validation:

```bash
scripts/install-dev.sh
npm run typecheck
bash scripts/test_backend.sh
npm test
npm run build
```

## Troubleshooting

- If Marketplace requests fail with `Marketplace is temporarily unavailable`, verify your network connection and try again.
- On macOS, if `npm install -g @mode-io/skill-manager` reports that Homebrew already owns `skill-manager`, uninstall the Homebrew formula first. The inverse also applies: uninstall the npm package before switching back to Homebrew.
- If an MCP harness is shown as unavailable, Skill Manager has detected that the local client is missing or does not support the required config surface.

## More to come

### Extension families

- [ ] Hook support
- [x] Slash command support
- [ ] Plugin support

### Harness expansion

- [ ] GitHub Copilot
- [ ] Gemini CLI
- [ ] Cline
- [ ] Windsurf
- [ ] Qwen Code
- [ ] Kimi Code
- [ ] Qoder

## Community

- See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.
- See [SECURITY.md](SECURITY.md) to report vulnerabilities privately.
