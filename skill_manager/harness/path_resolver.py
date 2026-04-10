from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ResolvedHarnessPaths:
    codex_user_root: Path
    codex_global_root: Path | None
    claude_user_root: Path
    claude_global_root: Path | None
    opencode_user_root: Path
    opencode_global_root: Path | None
    opencode_builtins: Path
    cursor_user_root: Path
    cursor_global_root: Path | None


def resolve_harness_paths(env: dict[str, str] | None = None) -> ResolvedHarnessPaths:
    active_env = env or {}
    home = Path(active_env.get("HOME", str(Path.home())))
    xdg_config_home = Path(active_env.get("XDG_CONFIG_HOME", home / ".config"))
    return ResolvedHarnessPaths(
        codex_user_root=Path(active_env.get("SKILL_MANAGER_CODEX_ROOT", home / ".codex" / "skills")),
        codex_global_root=_optional_path(active_env.get("SKILL_MANAGER_CODEX_GLOBAL_ROOT")),
        claude_user_root=Path(active_env.get("SKILL_MANAGER_CLAUDE_ROOT", home / ".claude" / "skills")),
        claude_global_root=_optional_path(active_env.get("SKILL_MANAGER_CLAUDE_GLOBAL_ROOT")),
        opencode_user_root=Path(active_env.get("SKILL_MANAGER_OPENCODE_ROOT", xdg_config_home / "opencode" / "skills")),
        opencode_global_root=_optional_path(active_env.get("SKILL_MANAGER_OPENCODE_GLOBAL_ROOT")),
        opencode_builtins=Path(active_env.get("SKILL_MANAGER_OPENCODE_BUILTINS", xdg_config_home / "opencode" / "builtins.json")),
        cursor_user_root=Path(active_env.get("SKILL_MANAGER_CURSOR_ROOT", home / ".cursor" / "skills")),
        cursor_global_root=_optional_path(active_env.get("SKILL_MANAGER_CURSOR_GLOBAL_ROOT")),
    )


def _optional_path(value: str | None) -> Path | None:
    if not value:
        return None
    return Path(value)
