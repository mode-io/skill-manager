from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Mapping

from skill_manager.atomic_files import atomic_write_text, file_lock


McpTransport = Literal["stdio", "http", "sse"]
McpSourceKind = Literal["marketplace", "adopted", "manual"]
CURRENT_MCP_MANIFEST_VERSION = 5


@dataclass(frozen=True)
class McpManifestIssue:
    name: str
    reason: str

    def to_dict(self) -> dict[str, str]:
        return {"name": self.name, "reason": self.reason}


@dataclass(frozen=True)
class McpSource:
    kind: McpSourceKind
    locator: str

    def to_dict(self) -> dict[str, str]:
        return {"kind": self.kind, "locator": self.locator}

    @classmethod
    def marketplace(cls, qualified_name: str) -> "McpSource":
        return cls(kind="marketplace", locator=qualified_name)

    @classmethod
    def adopted(cls, harness: str, name: str) -> "McpSource":
        return cls(kind="adopted", locator=f"{harness}:{name}")

    @classmethod
    def manual(cls, name: str) -> "McpSource":
        return cls(kind="manual", locator=name)


@dataclass(frozen=True)
class McpServerSpec:
    name: str
    display_name: str
    source: McpSource
    transport: McpTransport
    command: str | None = None
    args: tuple[str, ...] | None = None
    env: tuple[tuple[str, str], ...] | None = None
    url: str | None = None
    headers: tuple[tuple[str, str], ...] | None = None
    installed_at: str = ""
    revision: str = ""

    def env_dict(self) -> dict[str, str]:
        return dict(self.env) if self.env else {}

    def headers_dict(self) -> dict[str, str]:
        return dict(self.headers) if self.headers else {}

    def args_list(self) -> list[str]:
        return list(self.args) if self.args else []

    def to_dict(self) -> dict[str, object]:
        payload: dict[str, object] = {
            "name": self.name,
            "displayName": self.display_name,
            "source": self.source.to_dict(),
            "transport": self.transport,
            "installedAt": self.installed_at,
            "revision": self.revision,
        }
        if self.command is not None:
            payload["command"] = self.command
        if self.args is not None:
            payload["args"] = list(self.args)
        if self.env is not None:
            payload["env"] = dict(self.env)
        if self.url is not None:
            payload["url"] = self.url
        if self.headers is not None:
            payload["headers"] = dict(self.headers)
        return payload

    @classmethod
    def from_dict(cls, payload: Mapping[str, object]) -> "McpServerSpec":
        source_raw = payload.get("source", {})
        source = (
            McpSource(
                kind=source_raw.get("kind", "manual"),  # type: ignore[arg-type]
                locator=source_raw.get("locator", payload.get("name", "")),  # type: ignore[arg-type]
            )
            if isinstance(source_raw, Mapping)
            else McpSource.manual(str(payload.get("name", "")))
        )
        env_raw = payload.get("env")
        headers_raw = payload.get("headers")
        args_raw = payload.get("args")
        return cls(
            name=str(payload["name"]),
            display_name=str(payload.get("displayName", payload["name"])),
            source=source,
            transport=str(payload.get("transport", "stdio")),  # type: ignore[arg-type]
            command=_optional_str(payload.get("command")),
            args=tuple(str(a) for a in args_raw) if isinstance(args_raw, list) else None,
            env=tuple((str(k), str(v)) for k, v in env_raw.items()) if isinstance(env_raw, Mapping) else None,
            url=_optional_str(payload.get("url")),
            headers=tuple((str(k), str(v)) for k, v in headers_raw.items()) if isinstance(headers_raw, Mapping) else None,
            installed_at=str(payload.get("installedAt", "")),
            revision=str(payload.get("revision", "")),
        )


@dataclass(frozen=True)
class McpManagedManifest:
    entries: tuple[McpServerSpec, ...] = field(default_factory=tuple)

    def to_dict(self) -> dict[str, object]:
        return {
            "version": CURRENT_MCP_MANIFEST_VERSION,
            "servers": [entry.to_dict() for entry in self.entries],
        }


@dataclass(frozen=True)
class _ManifestLoadResult:
    manifest: McpManagedManifest
    issues: tuple[McpManifestIssue, ...] = ()


def _optional_str(value: object) -> str | None:
    if isinstance(value, str) and value:
        return value
    return None


def compute_revision(spec: McpServerSpec) -> str:
    payload = {
        "name": spec.name,
        "transport": spec.transport,
        "command": spec.command,
        "args": list(spec.args) if spec.args else None,
        "env": dict(spec.env) if spec.env else None,
        "url": spec.url,
        "headers": dict(spec.headers) if spec.headers else None,
    }
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()
    return digest[:16]


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def prepare_managed_spec(spec: McpServerSpec) -> McpServerSpec:
    stamped = spec if spec.installed_at else replace(spec, installed_at=now_iso())
    return replace(stamped, revision=compute_revision(stamped))


def write_mcp_manifest(path: Path, manifest: McpManagedManifest) -> None:
    atomic_write_text(
        path,
        json.dumps(manifest.to_dict(), ensure_ascii=False, indent=2, sort_keys=False) + "\n",
    )


class McpServerStore:
    """Cleartext local manifest of canonical observed MCP configs."""

    def __init__(self, manifest_path: Path) -> None:
        self.manifest_path = manifest_path

    @property
    def _lock_path(self) -> Path:
        return self.manifest_path.with_suffix(".lock")

    def list_managed(self) -> tuple[McpServerSpec, ...]:
        return self._load_manifest_result().manifest.entries

    def list_binding_specs(self) -> tuple[McpServerSpec, ...]:
        return self.list_managed()

    def list_public_specs(self) -> tuple[McpServerSpec, ...]:
        return self.list_managed()

    def get_managed(self, name: str) -> McpServerSpec | None:
        for entry in self.list_managed():
            if entry.name == name:
                return entry
        return None

    def get_binding_spec(self, name: str) -> McpServerSpec | None:
        return self.get_managed(name)

    def get_public_spec(self, name: str) -> McpServerSpec | None:
        return self.get_managed(name)

    def upsert_from_spec(self, spec: McpServerSpec) -> McpServerSpec:
        return self.upsert_managed(spec)

    def upsert_managed(self, server: McpServerSpec) -> McpServerSpec:
        with file_lock(self._lock_path):
            manifest = self._load_manifest_result().manifest
            stamped = prepare_managed_spec(server)
            new_entries = tuple(
                stamped if entry.name == stamped.name else entry for entry in manifest.entries
            )
            if not any(entry.name == stamped.name for entry in manifest.entries):
                new_entries = manifest.entries + (stamped,)
            write_mcp_manifest(self.manifest_path, McpManagedManifest(entries=new_entries))
            return stamped

    def remove(self, name: str) -> bool:
        with file_lock(self._lock_path):
            manifest = self._load_manifest_result().manifest
            new_entries = tuple(entry for entry in manifest.entries if entry.name != name)
            if len(new_entries) == len(manifest.entries):
                return False
            write_mcp_manifest(self.manifest_path, McpManagedManifest(entries=new_entries))
        return True

    def manifest_issues(self) -> tuple[McpManifestIssue, ...]:
        return self._load_manifest_result().issues

    def _load_manifest_result(self) -> _ManifestLoadResult:
        if not self.manifest_path.is_file():
            return _ManifestLoadResult(McpManagedManifest())
        payload = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        raw_entries = payload.get("servers", [])
        if not isinstance(raw_entries, list):
            return _ManifestLoadResult(
                McpManagedManifest(),
                issues=(McpManifestIssue(name="<manifest>", reason="'servers' must be a list"),),
            )
        entries: list[McpServerSpec] = []
        issues: list[McpManifestIssue] = []
        for item in raw_entries:
            if not isinstance(item, dict):
                issues.append(McpManifestIssue(name="<unknown>", reason="server entry must be an object"))
                continue
            name = str(item.get("name", "<unknown>"))
            try:
                entries.append(McpServerSpec.from_dict(item))
            except (KeyError, TypeError, ValueError) as error:
                issues.append(McpManifestIssue(name=name, reason=str(error) or error.__class__.__name__))
                continue
        return _ManifestLoadResult(
            McpManagedManifest(entries=tuple(entries)),
            issues=tuple(issues),
        )


__all__ = [
    "CURRENT_MCP_MANIFEST_VERSION",
    "McpManagedManifest",
    "McpManifestIssue",
    "McpServerSpec",
    "McpServerStore",
    "McpSource",
    "McpSourceKind",
    "McpTransport",
    "compute_revision",
    "now_iso",
    "prepare_managed_spec",
    "write_mcp_manifest",
]
