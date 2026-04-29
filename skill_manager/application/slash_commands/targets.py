from __future__ import annotations

from pathlib import Path

from skill_manager.harness.resolution import ResolutionContext

from .models import SlashTarget, SlashTargetId


TARGET_ORDER: tuple[SlashTargetId, ...] = ("opencode", "claude", "cursor", "codex")


def resolve_slash_targets(context: ResolutionContext) -> tuple[SlashTarget, ...]:
    home = context.home
    opencode_root = home / ".config" / "opencode"
    claude_root = home / ".claude"
    cursor_root = home / ".cursor"
    codex_root = home / ".codex"
    return (
        SlashTarget(
            id="opencode",
            label="OpenCode",
            root_path=opencode_root,
            output_dir=opencode_root / "commands",
            invocation_prefix="/",
            default_selected=opencode_root.exists(),
        ),
        SlashTarget(
            id="claude",
            label="Claude Code",
            root_path=claude_root,
            output_dir=claude_root / "commands",
            invocation_prefix="/",
            default_selected=claude_root.exists(),
        ),
        SlashTarget(
            id="cursor",
            label="Cursor",
            root_path=cursor_root,
            output_dir=cursor_root / "commands",
            invocation_prefix="/",
            default_selected=cursor_root.exists(),
        ),
        SlashTarget(
            id="codex",
            label="Codex",
            root_path=codex_root,
            output_dir=codex_root / "prompts",
            invocation_prefix="/prompts:",
            default_selected=codex_root.exists(),
        ),
    )


def default_target_ids(targets: tuple[SlashTarget, ...]) -> tuple[SlashTargetId, ...]:
    return tuple(target.id for target in targets if target.default_selected)


def target_by_id(targets: tuple[SlashTarget, ...], target_id: str) -> SlashTarget | None:
    return next((target for target in targets if target.id == target_id), None)


def slash_manager_root(context: ResolutionContext) -> Path:
    return context.home / ".slash-command-manager"


__all__ = ["TARGET_ORDER", "default_target_ids", "resolve_slash_targets", "slash_manager_root", "target_by_id"]
