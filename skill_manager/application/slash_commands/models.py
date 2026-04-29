from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal


SlashTargetId = Literal["opencode", "claude", "cursor", "codex"]
SlashTargetKind = Literal["file"]
SlashSyncStatus = Literal["synced", "removed", "not_selected", "blocked_manual_file", "failed"]


@dataclass(frozen=True)
class SlashCommand:
    name: str
    description: str
    prompt: str


@dataclass(frozen=True)
class SlashTarget:
    id: SlashTargetId
    label: str
    root_path: Path
    output_dir: Path
    invocation_prefix: str
    default_selected: bool
    kind: SlashTargetKind = "file"

    def output_path(self, command_name: str) -> Path:
        return self.output_dir / f"{command_name}.md"

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "label": self.label,
            "rootPath": str(self.root_path),
            "outputDir": str(self.output_dir),
            "invocationPrefix": self.invocation_prefix,
            "defaultSelected": self.default_selected,
        }


@dataclass(frozen=True)
class SlashCommandSyncEntry:
    target: SlashTargetId
    path: Path
    status: SlashSyncStatus
    error: str | None = None

    def to_dict(self) -> dict[str, object]:
        payload: dict[str, object] = {
            "target": self.target,
            "path": str(self.path),
            "status": self.status,
        }
        if self.error:
            payload["error"] = self.error
        return payload


__all__ = [
    "SlashCommand",
    "SlashCommandSyncEntry",
    "SlashSyncStatus",
    "SlashTarget",
    "SlashTargetId",
    "SlashTargetKind",
]
