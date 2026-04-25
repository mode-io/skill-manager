from __future__ import annotations

from pathlib import Path

from .contracts import (
    ConfigSubtreeBindingProfile,
    FamilyKey,
    FileTreeBindingProfile,
    FileTreeDiscoveryRoot,
    HarnessDefinition,
)


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
                codec="codex",
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
        },
    ),
    HarnessDefinition(
        harness="cursor",
        label="Cursor",
        logo_key="cursor",
        install_probe="cursor-agent",
        bindings={
            "skills": FileTreeBindingProfile(
                managed_env="SKILL_MANAGER_CURSOR_ROOT",
                managed_default=lambda context: context.home / ".cursor" / "skills",
            ),
            "mcp": ConfigSubtreeBindingProfile(
                config_path_resolver=lambda context: context.home / ".cursor" / "mcp.json",
                file_format="json",
                subtree_path=("mcpServers",),
                codec="cursor",
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
