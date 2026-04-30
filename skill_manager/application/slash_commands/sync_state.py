from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

from skill_manager.atomic_files import atomic_write_text, file_lock
from skill_manager.harness.contracts import CommandFileRenderFormat

from .models import SlashTargetId


SYNC_STATE_VERSION = 2


@dataclass(frozen=True)
class SlashCommandSyncRecord:
    target: SlashTargetId
    path: Path
    content_hash: str | None
    render_format: CommandFileRenderFormat

    def to_dict(self) -> dict[str, object]:
        return {
            "target": self.target,
            "path": str(self.path),
            "contentHash": self.content_hash,
            "renderFormat": self.render_format,
        }


SlashCommandSyncState = dict[str, dict[str, SlashCommandSyncRecord]]


class SlashCommandSyncStateStore:
    def __init__(self, path: Path) -> None:
        self.path = path

    @property
    def lock_path(self) -> Path:
        return self.path.with_suffix(".lock")

    def load(self) -> SlashCommandSyncState:
        if not self.path.is_file():
            return {}
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            return {}
        commands_payload = payload.get("commands", payload)
        if not isinstance(commands_payload, dict):
            return {}
        state: SlashCommandSyncState = {}
        for command_name, target_payload in commands_payload.items():
            if not isinstance(command_name, str) or not isinstance(target_payload, dict):
                continue
            records: dict[str, SlashCommandSyncRecord] = {}
            for target_id, raw_record in target_payload.items():
                record = _parse_record(str(target_id), raw_record)
                if record is not None:
                    records[record.target] = record
            if records:
                state[command_name] = records
        return state

    def write(self, state: SlashCommandSyncState) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": SYNC_STATE_VERSION,
            "commands": {
                command_name: {
                    target_id: record.to_dict()
                    for target_id, record in sorted(records.items())
                }
                for command_name, records in sorted(state.items())
                if records
            },
        }
        atomic_write_text(self.path, json.dumps(payload, indent=2, sort_keys=True) + "\n")

    def replace_for(self, name: str, records: dict[SlashTargetId, SlashCommandSyncRecord]) -> None:
        with file_lock(self.lock_path):
            state = self.load()
            if records:
                state[name] = dict(records)
            else:
                state.pop(name, None)
            self.write(state)

    def add_target(self, name: str, record: SlashCommandSyncRecord) -> None:
        with file_lock(self.lock_path):
            state = self.load()
            records = dict(state.get(name, {}))
            records[record.target] = record
            state[name] = records
            self.write(state)

    def remove_target(self, name: str, target: SlashTargetId) -> None:
        with file_lock(self.lock_path):
            state = self.load()
            records = dict(state.get(name, {}))
            records.pop(target, None)
            if records:
                state[name] = records
            else:
                state.pop(name, None)
            self.write(state)

    def remove_command(self, name: str) -> dict[str, SlashCommandSyncRecord]:
        with file_lock(self.lock_path):
            state = self.load()
            records = state.pop(name, {})
            self.write(state)
        return records


def hash_file(path: Path) -> str:
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return f"sha256:{digest}"


def _parse_record(target_id: str, raw_record: object) -> SlashCommandSyncRecord | None:
    if not isinstance(raw_record, dict):
        return None
    path = raw_record.get("path")
    render_format = raw_record.get("renderFormat")
    if not isinstance(path, str) or render_format not in {"frontmatter_markdown", "cursor_plaintext"}:
        return None
    return SlashCommandSyncRecord(
        target=target_id,  # type: ignore[arg-type]
        path=Path(path),
        content_hash=raw_record.get("contentHash") if isinstance(raw_record.get("contentHash"), str) else None,
        render_format=render_format,  # type: ignore[arg-type]
    )


__all__ = [
    "SYNC_STATE_VERSION",
    "SlashCommandSyncRecord",
    "SlashCommandSyncState",
    "SlashCommandSyncStateStore",
    "hash_file",
]
