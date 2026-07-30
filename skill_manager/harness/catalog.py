from __future__ import annotations

from pathlib import Path
import re
from typing import Mapping

from skill_manager.user_environment import live_user_environment_value

from .contracts import (
    CommandFileBindingProfile,
    ConfigSubtreeBindingProfile,
    FamilyKey,
    FileTreeBindingProfile,
    FileTreeDiscoveryRoot,
    HarnessDefinition,
)


_CODEX_DESKTOP_MCP_ENV_MARKERS = frozenset(
    {
        "CODEX_CLI_PATH",
        "NODE_REPL_NODE_PATH",
        "SKY_CUA_NATIVE_PIPE_DIRECTORY",
    }
)


def _is_codex_desktop_runtime_mcp(
    name: str,
    payload: Mapping[str, object],
    _context,
) -> bool:
    if name.casefold() != "node_repl":
        return False
    command = payload.get("command")
    if not isinstance(command, str):
        return False
    command_name = re.split(r"[/\\]", command)[-1].casefold()
    if command_name not in {"node_repl", "node_repl.exe"}:
        return False
    env = payload.get("env")
    if not isinstance(env, Mapping):
        return False
    env_keys = {str(key).upper() for key in env}
    return _CODEX_DESKTOP_MCP_ENV_MARKERS.issubset(env_keys)


def _hermes_home(context) -> Path:
    override = context.env.get("SKILL_MANAGER_HERMES_HOME") or context.env.get("HERMES_HOME")
    if override:
        return Path(override)
    if context.platform != "windows":
        return context.home / ".hermes"

    for variable in ("SKILL_MANAGER_HERMES_HOME", "HERMES_HOME"):
        user_override = live_user_environment_value(variable, context.env)
        if user_override:
            return Path(user_override)

    local_app_data = context.env.get("LOCALAPPDATA")
    if not local_app_data:
        return context.home / ".hermes"

    native_home = Path(local_app_data) / "hermes"
    legacy_home = context.home / ".hermes"
    if not native_home.exists() and legacy_home.exists():
        return legacy_home
    return native_home


def _hermes_skills_root(context) -> Path:
    return _hermes_home(context) / "skills"


def _hermes_config_path(context) -> Path:
    return _hermes_home(context) / "config.yaml"


def supported_harness_definitions() -> tuple[HarnessDefinition, ...]:
    return SUPPORTED_HARNESS_DEFINITIONS


def supported_harness_ids() -> tuple[str, ...]:
    return tuple(definition.harness for definition in SUPPORTED_HARNESS_DEFINITIONS)


def harness_definitions_for_family(family: FamilyKey) -> tuple[HarnessDefinition, ...]:
    return tuple(
        definition for definition in SUPPORTED_HARNESS_DEFINITIONS if definition.supports_family(family)
    )


SUPPORTED_HARNESS_DEFINITIONS: tuple[HarnessDefinition, ...] = (
    HarnessDefinition(
        harness="codex",
        label="Codex",
        logo_key="codex",
        install_probe="codex",
        bindings={
            "skills": FileTreeBindingProfile(
                managed_env="SKILL_MANAGER_CODEX_ROOT",
                managed_default=lambda context: context.home / ".agents" / "skills",
                discovery_roots=(
                    FileTreeDiscoveryRoot(
                        kind="admin-root",
                        scope="admin",
                        label="Admin skills root",
                        path_resolver=lambda _context: Path("/etc/codex/skills"),
                    ),
                    FileTreeDiscoveryRoot(
                        kind="legacy-root",
                        scope="legacy",
                        label="Legacy import root",
                        path_resolver=lambda context: context.home / ".codex" / "skills",
                    ),
                ),
            ),
            "mcp": ConfigSubtreeBindingProfile(
                config_path_resolver=lambda context: context.home / ".codex" / "config.toml",
                file_format="toml",
                subtree_path=("mcp_servers",),
                unmanaged_entry_exclusion=_is_codex_desktop_runtime_mcp,
                codec="codex",
            ),
            "slash_commands": CommandFileBindingProfile(
                root_path_resolver=lambda context: context.home / ".codex",
                output_dir_resolver=lambda context: context.home / ".codex" / "prompts",
                invocation_prefix="/prompts:",
                render_format="frontmatter_markdown",
                scope="global",
                docs_url="https://developers.openai.com/codex/custom-prompts",
                file_glob="*.md",
                supports_frontmatter=True,
                support_note="Codex custom prompts are deprecated in favor of skills, but this prompt directory remains verified for slash-command compatibility.",
            ),
        },
    ),
    HarnessDefinition(
        harness="claude",
        label="Claude",
        logo_key="claude",
        install_probe="claude",
        bindings={
            "skills": FileTreeBindingProfile(
                managed_env="SKILL_MANAGER_CLAUDE_ROOT",
                managed_default=lambda context: context.home / ".claude" / "skills",
            ),
            "mcp": ConfigSubtreeBindingProfile(
                config_path_resolver=lambda context: context.home / ".claude.json",
                file_format="json",
                subtree_path=("mcpServers",),
                discovery_subtree_path_resolvers=(
                    lambda context: ("projects", str(context.home), "mcpServers"),
                    lambda context: ("projects", str(context.home.resolve()), "mcpServers"),
                ),
                codec="claude-code",
            ),
            "slash_commands": CommandFileBindingProfile(
                root_path_resolver=lambda context: context.home / ".claude",
                output_dir_resolver=lambda context: context.home / ".claude" / "commands",
                invocation_prefix="/",
                render_format="frontmatter_markdown",
                scope="global",
                docs_url="https://code.claude.com/docs/en/slash-commands",
                file_glob="*.md",
                supports_frontmatter=True,
                support_note="Claude Code has merged custom commands into skills, while existing .claude/commands files remain supported.",
            ),
        },
    ),
    HarnessDefinition(
        harness="cursor",
        label="Cursor",
        logo_key="cursor",
        install_probe="cursor-agent",
        windows_install_probe_aliases=("cursor",),
        bindings={
            "skills": FileTreeBindingProfile(
                managed_env="SKILL_MANAGER_CURSOR_ROOT",
                managed_default=lambda context: context.home / ".cursor" / "skills",
                availability="cli_or_app",
                app_probe_paths=(
                    lambda _context: Path("/Applications/Cursor.app"),
                    lambda context: context.home / "Applications" / "Cursor.app",
                ),
            ),
            "mcp": ConfigSubtreeBindingProfile(
                config_path_resolver=lambda context: context.home / ".cursor" / "mcp.json",
                file_format="json",
                subtree_path=("mcpServers",),
                codec="cursor",
            ),
            "slash_commands": CommandFileBindingProfile(
                root_path_resolver=lambda context: context.home / ".cursor",
                output_dir_resolver=lambda context: context.home / ".cursor" / "commands",
                invocation_prefix="/",
                render_format="cursor_plaintext",
                scope="global",
                docs_url="https://cursor.com/changelog/1-6",
                file_glob="*.md",
                supports_frontmatter=False,
                support_note="Cursor slash command support is verified locally; current public docs emphasize skills while older command files remain supported in practice.",
            ),
        },
    ),
    HarnessDefinition(
        harness="opencode",
        label="OpenCode",
        logo_key="opencode",
        install_probe="opencode",
        bindings={
            "skills": FileTreeBindingProfile(
                managed_env="SKILL_MANAGER_OPENCODE_ROOT",
                managed_default=lambda context: context.xdg_config_home / "opencode" / "skills",
                availability="cli",
                discovery_roots=(
                    FileTreeDiscoveryRoot(
                        kind="compat-root",
                        scope="claude-compat",
                        label="Claude compatibility root",
                        path_resolver=lambda context: context.home / ".claude" / "skills",
                    ),
                    FileTreeDiscoveryRoot(
                        kind="compat-root",
                        scope="agents-compat",
                        label="Agents compatibility root",
                        path_resolver=lambda context: context.home / ".agents" / "skills",
                    ),
                ),
            ),
            "mcp": ConfigSubtreeBindingProfile(
                config_path_resolver=lambda context: context.home / ".opencode" / "opencode.jsonc",
                discovery_config_path_resolvers=(
                    lambda context: context.xdg_config_home / "opencode" / "opencode.json",
                ),
                source_install_config_path_resolvers=(
                    lambda context: context.home / ".opencode" / "opencode.jsonc",
                ),
                file_format="jsonc",
                subtree_path=("mcp",),
                codec="opencode",
            ),
            "slash_commands": CommandFileBindingProfile(
                root_path_resolver=lambda context: context.xdg_config_home / "opencode",
                output_dir_resolver=lambda context: context.xdg_config_home / "opencode" / "commands",
                invocation_prefix="/",
                render_format="frontmatter_markdown",
                scope="global",
                docs_url="https://opencode.ai/docs/commands/",
                file_glob="*.md",
                supports_frontmatter=True,
            ),
        },
    ),
    HarnessDefinition(
        harness="hermes",
        label="Hermes",
        logo_key="hermes",
        install_probe="hermes",
        bindings={
            "skills": FileTreeBindingProfile(
                managed_env="SKILL_MANAGER_HERMES_ROOT",
                managed_default=_hermes_skills_root,
                layout="categorized",
                default_category="skill-manager",
            ),
            "mcp": ConfigSubtreeBindingProfile(
                config_path_resolver=_hermes_config_path,
                file_format="yaml",
                subtree_path=("mcp_servers",),
                codec="hermes",
            ),
        },
    ),
    HarnessDefinition(
        harness="openclaw",
        label="OpenClaw",
        logo_key="openclaw",
        install_probe="openclaw",
        bindings={
            "skills": FileTreeBindingProfile(
                managed_default=lambda context: context.home / ".openclaw" / "skills",
                discovery_roots=(
                    FileTreeDiscoveryRoot(
                        kind="personal-root",
                        scope="personal-agent",
                        label="Personal agent skills root",
                        path_resolver=lambda context: context.home / ".agents" / "skills",
                    ),
                ),
            ),
            "mcp": ConfigSubtreeBindingProfile(
                config_path_resolver=lambda context: context.home / ".openclaw" / "openclaw.json",
                file_format="json",
                subtree_path=("mcp", "servers"),
                codec="openclaw",
                capability_probe="openclaw-mcp-command",
                capability_unavailable_reason=(
                    "Installed OpenClaw does not expose MCP config support"
                ),
            ),
        },
    ),
)


__all__ = [
    "SUPPORTED_HARNESS_DEFINITIONS",
    "harness_definitions_for_family",
    "supported_harness_definitions",
    "supported_harness_ids",
]
