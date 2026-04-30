from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from skill_manager.harness.contracts import CommandFileRenderFormat, CommandFileScope


SlashTargetId = Literal["opencode", "claude", "cursor", "codex"]
SlashSyncStatus = Literal[
    "synced",
    "removed",
    "not_selected",
    "blocked_manual_file",
    "blocked_modified_file",
    "missing",
    "drifted",
    "failed",
]
SlashReviewKind = Literal["unmanaged", "drifted", "missing"]
SlashReviewAction = Literal["import", "restore_managed", "adopt_target", "remove_binding"]


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
    render_format: CommandFileRenderFormat
    scope: CommandFileScope
    docs_url: str
    file_glob: str
    supports_frontmatter: bool
    support_note: str | None
    enabled: bool
    available: bool
    default_selected: bool

    def to_dict(self) -> dict[str, object]:
        return {
            "id": self.id,
            "label": self.label,
            "rootPath": str(self.root_path),
            "outputDir": str(self.output_dir),
            "invocationPrefix": self.invocation_prefix,
            "renderFormat": self.render_format,
            "scope": self.scope,
            "docsUrl": self.docs_url,
            "fileGlob": self.file_glob,
            "supportsFrontmatter": self.supports_frontmatter,
            "supportNote": self.support_note,
            "defaultSelected": self.default_selected,
            "enabled": self.enabled,
            "available": self.available,
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


@dataclass(frozen=True)
class SlashCommandReviewRow:
    kind: SlashReviewKind
    target: SlashTarget
    name: str
    path: Path
    description: str
    prompt: str
    command_exists: bool
    actions: tuple[SlashReviewAction, ...]
    error: str | None = None

    def to_dict(self) -> dict[str, object]:
        return {
            "reviewRef": f"{self.kind}:{self.target.id}:{self.name}",
            "kind": self.kind,
            "target": self.target.id,
            "targetLabel": self.target.label,
            "name": self.name,
            "path": str(self.path),
            "description": self.description,
            "prompt": self.prompt,
            "commandExists": self.command_exists,
            "canImport": "import" in self.actions and self.error is None,
            "actions": list(self.actions),
            "error": self.error,
        }


__all__ = [
    "SlashCommand",
    "SlashCommandReviewRow",
    "SlashCommandSyncEntry",
    "SlashReviewAction",
    "SlashReviewKind",
    "SlashSyncStatus",
    "SlashTarget",
    "SlashTargetId",
]
