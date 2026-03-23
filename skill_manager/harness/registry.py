from __future__ import annotations

from skill_manager.domain import HarnessScan

from .adapters.config_backed import ConfigHarnessAdapter
from .adapters.filesystem_backed import FilesystemHarnessAdapter
from .adapters.gemini_cli import GeminiCliHarnessAdapter
from .command_runner import CommandRunner, SubprocessCommandRunner
from .contracts import AdapterConfig, HarnessAdapter
from .path_resolver import resolve_harness_paths


def create_default_adapters(
    env: dict[str, str] | None = None,
    *,
    command_runner: CommandRunner | None = None,
) -> tuple[HarnessAdapter, ...]:
    active_env = env or {}
    paths = resolve_harness_paths(active_env)
    runner = command_runner or SubprocessCommandRunner()
    return (
        FilesystemHarnessAdapter(
            config=AdapterConfig("codex", "Codex", "filesystem", False),
            env=active_env,
            user_skills_root=paths.codex_user_root,
            global_skills_root=paths.codex_global_root,
        ),
        FilesystemHarnessAdapter(
            config=AdapterConfig("claude", "Claude", "filesystem", False),
            env=active_env,
            user_skills_root=paths.claude_user_root,
            global_skills_root=paths.claude_global_root,
        ),
        ConfigHarnessAdapter(
            config=AdapterConfig("opencode", "OpenCode", "config", True),
            env=active_env,
            user_skills_root=paths.opencode_user_root,
            global_skills_root=paths.opencode_global_root,
            builtins_path=paths.opencode_builtins,
        ),
        ConfigHarnessAdapter(
            config=AdapterConfig("openclaw", "OpenClaw", "config", True),
            env=active_env,
            user_skills_root=paths.openclaw_user_root,
            global_skills_root=paths.openclaw_global_root,
            builtins_path=paths.openclaw_builtins,
        ),
        GeminiCliHarnessAdapter(
            env=active_env,
            command_runner=runner,
            user_skills_root=paths.gemini_user_root,
            builtins_path=paths.gemini_builtins,
        ),
    )


def scan_all_harnesses(adapters: tuple[HarnessAdapter, ...]) -> tuple[HarnessScan, ...]:
    return tuple(adapter.scan() for adapter in adapters)
