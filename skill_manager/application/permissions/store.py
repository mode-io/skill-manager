from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Mapping

from skill_manager.atomic_files import atomic_write_text, file_lock

CURRENT_PERMISSIONS_MANIFEST_VERSION = 1


@dataclass(frozen=True)
class PermissionManifestIssue:
    name: str
    reason: str

    def to_dict(self) -> dict[str, str]:
        return {"name": self.name, "reason": self.reason}


@dataclass(frozen=True)
class PermissionSpec:
    id: str
    decision: str           # "allow" | "deny" | "ask"
    scope: str              # "shell" | "file_read" | "file_write" | "web" | "mcp" | "any"
    pattern: str | None = None   # opaque specifier, interpreted per scope:
                                 #   shell -> command prefix ("git push")
                                 #   file_read/file_write -> path glob ("~/.zshrc", "./secrets/**")
                                 #   web -> domain ("api.example.com")
                                 #   mcp -> "server/tool" or "server" (server-wide)
    description: str = ""
    installed_at: str = ""
    revision: str = ""

    def to_dict(self) -> dict[str, object]:
        payload: dict[str, object] = {
            "id": self.id,
            "decision": self.decision,
            "scope": self.scope,
            "description": self.description,
            "installedAt": self.installed_at,
            "revision": self.revision,
        }
        if self.pattern is not None:
            payload["pattern"] = self.pattern
        return payload

    @classmethod
    def from_dict(cls, payload: Mapping[str, object]) -> PermissionSpec:
        return cls(
            id=str(payload["id"]),
            decision=str(payload["decision"]),
            scope=str(payload["scope"]),
            pattern=_optional_str(payload.get("pattern")),
            description=str(payload.get("description", "")),
            installed_at=str(payload.get("installedAt", "")),
            revision=str(payload.get("revision", "")),
        )


@dataclass(frozen=True)
class PermissionManagedManifest:
    entries: tuple[PermissionSpec, ...] = field(default_factory=tuple)

    def to_dict(self) -> dict[str, object]:
        return {
            "version": CURRENT_PERMISSIONS_MANIFEST_VERSION,
            "permissions": [entry.to_dict() for entry in self.entries],
        }


@dataclass(frozen=True)
class _ManifestLoadResult:
    manifest: PermissionManagedManifest
    issues: tuple[PermissionManifestIssue, ...] = ()


def _optional_str(value: object) -> str | None:
    if isinstance(value, str) and value:
        return value
    return None


def compute_revision(spec: PermissionSpec) -> str:
    payload = {
        "id": spec.id,
        "decision": spec.decision,
        "scope": spec.scope,
        "pattern": spec.pattern,
    }
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()
    return digest[:16]


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def prepare_managed_spec(spec: PermissionSpec) -> PermissionSpec:
    stamped = spec if spec.installed_at else replace(spec, installed_at=now_iso())
    return replace(stamped, revision=compute_revision(stamped))


def write_permissions_manifest(path: Path, manifest: PermissionManagedManifest) -> None:
    atomic_write_text(
        path,
        json.dumps(manifest.to_dict(), ensure_ascii=False, indent=2, sort_keys=False) + "\n",
    )


class PermissionStore:
    """Cleartext local manifest of canonical observed Permissions."""

    def __init__(self, manifest_path: Path) -> None:
        self.manifest_path = manifest_path

    @property
    def _lock_path(self) -> Path:
        return self.manifest_path.with_suffix(".lock")

    def list_managed(self) -> tuple[PermissionSpec, ...]:
        return self._load_manifest_result().manifest.entries

    def get_managed(self, id: str) -> PermissionSpec | None:
        for spec in self.list_managed():
            if spec.id == id:
                return spec
        return None

    def upsert_managed(self, spec: PermissionSpec) -> PermissionSpec:
        with file_lock(self._lock_path):
            manifest = self._load_manifest_result().manifest
            stamped = prepare_managed_spec(spec)
            new_entries = tuple(
                stamped if entry.id == stamped.id else entry for entry in manifest.entries
            )
            if not any(entry.id == stamped.id for entry in manifest.entries):
                new_entries = manifest.entries + (stamped,)
            write_permissions_manifest(self.manifest_path, PermissionManagedManifest(entries=new_entries))
            return stamped

    def remove(self, id: str) -> bool:
        with file_lock(self._lock_path):
            manifest = self._load_manifest_result().manifest
            new_entries = tuple(entry for entry in manifest.entries if entry.id != id)
            if len(new_entries) == len(manifest.entries):
                return False
            write_permissions_manifest(self.manifest_path, PermissionManagedManifest(entries=new_entries))
        return True

    def manifest_issues(self) -> tuple[PermissionManifestIssue, ...]:
        return self._load_manifest_result().issues

    def _load_manifest_result(self) -> _ManifestLoadResult:
        if not self.manifest_path.is_file():
            return _ManifestLoadResult(PermissionManagedManifest())
        try:
            payload = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        except Exception as error:
            return _ManifestLoadResult(
                PermissionManagedManifest(),
                issues=(PermissionManifestIssue(name="<manifest>", reason=str(error)),),
            )
        raw_entries = payload.get("permissions", [])
        if not isinstance(raw_entries, list):
            return _ManifestLoadResult(
                PermissionManagedManifest(),
                issues=(PermissionManifestIssue(name="<manifest>", reason="'permissions' must be a list"),),
            )
        records = []
        issues: list[PermissionManifestIssue] = []
        for item in raw_entries:
            if not isinstance(item, dict):
                issues.append(PermissionManifestIssue(name="<unknown>", reason="permission entry must be an object"))
                continue
            id_ = str(item.get("id", "<unknown>"))
            try:
                record = PermissionSpec.from_dict(item)
                records.append(record)
            except (KeyError, TypeError, ValueError) as error:
                issues.append(PermissionManifestIssue(name=id_, reason=str(error) or error.__class__.__name__))
                continue
        return _ManifestLoadResult(
            PermissionManagedManifest(entries=tuple(records)),
            issues=tuple(issues),
        )


__all__ = [
    "CURRENT_PERMISSIONS_MANIFEST_VERSION",
    "PermissionManagedManifest",
    "PermissionManifestIssue",
    "PermissionSpec",
    "PermissionStore",
    "compute_revision",
    "now_iso",
    "prepare_managed_spec",
    "write_permissions_manifest",
]
