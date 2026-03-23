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
    openclaw_user_root: Path
    openclaw_global_root: Path | None
    openclaw_builtins: Path
    gemini_user_root: Path
    gemini_builtins: Path


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
        openclaw_user_root=Path(active_env.get("SKILL_MANAGER_OPENCLAW_ROOT", xdg_config_home / "openclaw" / "skills")),
        openclaw_global_root=_optional_path(active_env.get("SKILL_MANAGER_OPENCLAW_GLOBAL_ROOT")),
        openclaw_builtins=Path(active_env.get("SKILL_MANAGER_OPENCLAW_BUILTINS", xdg_config_home / "openclaw" / "builtins.json")),
        gemini_user_root=Path(active_env.get("SKILL_MANAGER_GEMINI_ROOT", xdg_config_home / "gemini" / "skills")),
        gemini_builtins=Path(active_env.get("SKILL_MANAGER_GEMINI_BUILTINS", xdg_config_home / "gemini" / "builtins.json")),
    )


def _optional_path(value: str | None) -> Path | None:
    if not value:
        return None
    return Path(value)
