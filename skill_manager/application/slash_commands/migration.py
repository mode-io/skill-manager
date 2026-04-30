from __future__ import annotations

import json
from pathlib import Path

from skill_manager.errors import MutationError
from skill_manager.harness.resolution import ResolutionContext

from .models import SlashCommand, SlashTarget
from .path_policy import SlashCommandPathPolicy
from .store import SlashCommandStore
from .sync_state import SlashCommandSyncRecord, SlashCommandSyncStateStore, hash_file
from .targets import target_by_id


def migrate_legacy_slash_commands(
    *,
    command_store: SlashCommandStore,
    sync_state_store: SlashCommandSyncStateStore,
    context: ResolutionContext,
    targets: tuple[SlashTarget, ...],
    path_policy: SlashCommandPathPolicy | None = None,
) -> None:
    active_path_policy = path_policy or SlashCommandPathPolicy()
    legacy_root = context.home / ".slash-command-manager"
    legacy_commands_dir = legacy_root / "commands"
    legacy_sync_state_path = legacy_root / "sync-state.json"
    if not legacy_commands_dir.exists() and not legacy_sync_state_path.exists():
        return

    legacy_command_paths = sorted(legacy_commands_dir.glob("*.yaml")) if legacy_commands_dir.is_dir() else ()
    for path in legacy_command_paths:
        try:
            command = _parse_legacy_command(path)
        except MutationError:
            continue
        if command_store.get_command(command.name) is None:
            command_store.create_command(command)

    if not legacy_sync_state_path.is_file():
        return

    try:
        legacy_state = json.loads(legacy_sync_state_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return
    if not isinstance(legacy_state, dict):
        return

    state = sync_state_store.load()
    changed = False
    for command_name, target_paths in legacy_state.items():
        if not isinstance(command_name, str) or not isinstance(target_paths, dict):
            continue
        records = dict(state.get(command_name, {}))
        for target_id, raw_path in target_paths.items():
            if target_id in records or not isinstance(target_id, str) or not isinstance(raw_path, str):
                continue
            target = target_by_id(targets, target_id)
            if target is None:
                continue
            try:
                path = active_path_policy.tracked_path(target, Path(raw_path))
            except MutationError:
                continue
            records[target.id] = SlashCommandSyncRecord(
                target=target.id,
                path=path,
                content_hash=hash_file(path) if path.exists() else None,
                render_format=target.render_format,
            )
            changed = True
        if records:
            state[command_name] = records
    if changed:
        sync_state_store.write(state)


def _parse_legacy_command(path: Path) -> SlashCommand:
    payload = _parse_legacy_yaml(path.read_text(encoding="utf-8"))
    command = SlashCommand(
        name=payload.get("name", ""),
        description=payload.get("description", ""),
        prompt=payload.get("prompt", ""),
    )
    if path.stem != command.name:
        raise MutationError("legacy command name does not match filename", status=400)
    return command


def _parse_legacy_yaml(content: str) -> dict[str, str]:
    lines = content.splitlines()
    result: dict[str, str] = {}
    index = 0
    while index < len(lines):
        line = lines[index]
        index += 1
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if ":" not in line:
            continue
        key, raw_value = line.split(":", 1)
        key = key.strip()
        value = raw_value.strip()
        if key not in {"name", "description", "prompt"}:
            continue
        if key == "prompt" and value in {"|", "|-"}:
            block: list[str] = []
            while index < len(lines):
                block_line = lines[index]
                if block_line and not block_line[0].isspace():
                    break
                block.append(block_line[2:] if block_line.startswith("  ") else block_line.lstrip())
                index += 1
            result[key] = "\n".join(block).rstrip()
        else:
            result[key] = _unquote_legacy_scalar(value)
    return result


def _unquote_legacy_scalar(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


__all__ = ["migrate_legacy_slash_commands"]
