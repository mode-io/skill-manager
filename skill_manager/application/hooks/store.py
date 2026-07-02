from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Mapping

from skill_manager.atomic_files import atomic_write_text, file_lock


CURRENT_HOOKS_MANIFEST_VERSION = 1


@dataclass(frozen=True)
class HookManifestIssue:
    name: str
    reason: str

    def to_dict(self) -> dict[str, str]:
        return {"name": self.name, "reason": self.reason}


@dataclass(frozen=True)
class HookSpec:
    id: str
    event: str
    command: str
    match: str | None = None
    timeout: int | None = None
    description: str = ""
    installed_at: str = ""
    revision: str = ""

    def to_dict(self) -> dict[str, object]:
        payload: dict[str, object] = {
            "id": self.id,
            "event": self.event,
            "command": self.command,
            "description": self.description,
            "installedAt": self.installed_at,
            "revision": self.revision,
        }
        if self.match is not None:
            payload["match"] = self.match
        if self.timeout is not None:
            payload["timeout"] = self.timeout
        return payload

    @classmethod
    def from_dict(cls, payload: Mapping[str, object]) -> HookSpec:
        event = str(payload["event"])
        event_map = {
            "PreToolUse": "pre_tool_use",
            "PostToolUse": "post_tool_use",
            "UserPromptSubmit": "user_prompt_submit",
            "SessionStart": "session_start",
            "Stop": "stop",
            "PreCompact": "pre_compact",
        }
        event = event_map.get(event, event)

        match = _optional_str(payload.get("match"))
        matcher = _optional_str(payload.get("matcher"))
        if match is None and matcher is not None:
            matcher_map = {
                "Bash": "shell",
                "Read": "file_read",
                "Edit|Write": "file_write",
                "Edit": "file_write",
                "Write": "file_write",
                "mcp__.*": "mcp",
                "WebFetch": "web",
                "*": "any",
            }
            match = matcher_map.get(matcher, matcher)

        return cls(
            id=str(payload["id"]),
            event=event,
            command=str(payload["command"]),
            match=match,
            timeout=_optional_int(payload.get("timeout")),
            description=str(payload.get("description", "")),
            installed_at=str(payload.get("installedAt", "")),
            revision=str(payload.get("revision", "")),
        )


@dataclass(frozen=True)
class HookManagedManifest:
    entries: tuple[HookSpec, ...] = field(default_factory=tuple)

    def to_dict(self) -> dict[str, object]:
        return {
            "version": CURRENT_HOOKS_MANIFEST_VERSION,
            "hooks": [entry.to_dict() for entry in self.entries],
        }


@dataclass(frozen=True)
class _ManifestLoadResult:
    manifest: HookManagedManifest
    issues: tuple[HookManifestIssue, ...] = ()


def _optional_str(value: object) -> str | None:
    if isinstance(value, str) and value:
        return value
    return None


def _optional_int(value: object) -> int | None:
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def compute_revision(spec: HookSpec) -> str:
    payload = {
        "id": spec.id,
        "event": spec.event,
        "command": spec.command,
        "match": spec.match,
        "timeout": spec.timeout,
    }
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()
    return digest[:16]


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def prepare_managed_spec(spec: HookSpec) -> HookSpec:
    stamped = spec if spec.installed_at else replace(spec, installed_at=now_iso())
    return replace(stamped, revision=compute_revision(stamped))


def write_hooks_manifest(path: Path, manifest: HookManagedManifest) -> None:
    atomic_write_text(
        path,
        json.dumps(manifest.to_dict(), ensure_ascii=False, indent=2, sort_keys=False) + "\n",
    )


class HookStore:
    """Cleartext local manifest of canonical observed Hooks."""

    def __init__(self, manifest_path: Path) -> None:
        self.manifest_path = manifest_path

    @property
    def _lock_path(self) -> Path:
        return self.manifest_path.with_suffix(".lock")

    def list_managed(self) -> tuple[HookSpec, ...]:
        return self._load_manifest_result().manifest.entries

    def get_managed(self, id: str) -> HookSpec | None:
        for spec in self.list_managed():
            if spec.id == id:
                return spec
        return None

    def upsert_managed(self, spec: HookSpec) -> HookSpec:
        with file_lock(self._lock_path):
            manifest = self._load_manifest_result().manifest
            stamped = prepare_managed_spec(spec)
            new_entries = tuple(
                stamped if entry.id == stamped.id else entry for entry in manifest.entries
            )
            if not any(entry.id == stamped.id for entry in manifest.entries):
                new_entries = manifest.entries + (stamped,)
            write_hooks_manifest(self.manifest_path, HookManagedManifest(entries=new_entries))
            return stamped

    def remove(self, id: str) -> bool:
        with file_lock(self._lock_path):
            manifest = self._load_manifest_result().manifest
            new_entries = tuple(entry for entry in manifest.entries if entry.id != id)
            if len(new_entries) == len(manifest.entries):
                return False
            write_hooks_manifest(self.manifest_path, HookManagedManifest(entries=new_entries))
        return True

    def manifest_issues(self) -> tuple[HookManifestIssue, ...]:
        return self._load_manifest_result().issues

    def _load_manifest_result(self) -> _ManifestLoadResult:
        if not self.manifest_path.is_file():
            return _ManifestLoadResult(HookManagedManifest())
        try:
            payload = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        except Exception as error:
            return _ManifestLoadResult(
                HookManagedManifest(),
                issues=(HookManifestIssue(name="<manifest>", reason=str(error)),),
            )
        raw_entries = payload.get("hooks", [])
        if not isinstance(raw_entries, list):
            return _ManifestLoadResult(
                HookManagedManifest(),
                issues=(HookManifestIssue(name="<manifest>", reason="'hooks' must be a list"),),
            )
        records = []
        issues: list[HookManifestIssue] = []
        for item in raw_entries:
            if not isinstance(item, dict):
                issues.append(HookManifestIssue(name="<unknown>", reason="hook entry must be an object"))
                continue
            id_ = str(item.get("id", "<unknown>"))
            try:
                record = HookSpec.from_dict(item)
                records.append(record)
            except (KeyError, TypeError, ValueError) as error:
                issues.append(HookManifestIssue(name=id_, reason=str(error) or error.__class__.__name__))
                continue
        return _ManifestLoadResult(
            HookManagedManifest(entries=tuple(records)),
            issues=tuple(issues),
        )


__all__ = [
    "CURRENT_HOOKS_MANIFEST_VERSION",
    "HookManagedManifest",
    "HookManifestIssue",
    "HookSpec",
    "HookStore",
    "compute_revision",
    "now_iso",
    "prepare_managed_spec",
    "write_hooks_manifest",
]
