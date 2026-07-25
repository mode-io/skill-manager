from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Protocol

from .store import PermissionSpec

BindingState = Literal["managed", "drifted", "unmanaged", "missing", "unsupported"]


@dataclass(frozen=True)
class PermissionHarnessStatus:
    harness: str
    label: str
    logo_key: str | None
    installed: bool
    config_path: Path
    config_present: bool
    permissions_writable: bool = True
    permissions_unavailable_reason: str | None = None


@dataclass(frozen=True)
class PermissionObservedEntry:
    id: str
    decision: str
    state: BindingState
    raw_payload: dict[str, object] | None = None
    parsed_spec: PermissionSpec | None = None
    drift_detail: str | None = None
    parse_issue: str | None = None
    caveat: str | None = None


@dataclass(frozen=True)
class PermissionBinding:
    harness: str
    id: str
    state: BindingState
    drift_detail: str | None = None
    caveat: str | None = None


@dataclass(frozen=True)
class PermissionHarnessScan:
    harness: str
    label: str
    logo_key: str | None
    installed: bool
    config_present: bool
    config_path: Path
    permissions_writable: bool = True
    permissions_unavailable_reason: str | None = None
    scan_issue: str | None = None
    entries: tuple[PermissionObservedEntry, ...] = ()


@dataclass(frozen=True)
class PermissionInventoryEntry:
    id: str
    display_name: str
    spec: PermissionSpec | None
    sightings: tuple[PermissionBinding, ...]
    is_managed: bool
    can_enable: bool = True

    @property
    def kind(self) -> str:
        return "managed" if self.is_managed else "unmanaged"


@dataclass(frozen=True)
class PermissionInventoryIssue:
    name: str
    reason: str


@dataclass(frozen=True)
class PermissionInventory:
    columns: tuple[str, ...]
    entries: tuple[PermissionInventoryEntry, ...]
    issues: tuple[PermissionInventoryIssue, ...] = ()


class PermissionHarnessAdapter(Protocol):
    harness: str
    label: str
    logo_key: str | None
    config_path: Path

    def status(self) -> PermissionHarnessStatus: ...

    def scan(self, specs: tuple[PermissionSpec, ...]) -> PermissionHarnessScan: ...

    def has_binding(self, id: str) -> bool: ...

    def enable_permission(self, spec: PermissionSpec) -> None: ...

    def disable_permission(self, id: str) -> None: ...

    def invalidate(self) -> None: ...


__all__ = [
    "BindingState",
    "PermissionBinding",
    "PermissionHarnessAdapter",
    "PermissionHarnessScan",
    "PermissionHarnessStatus",
    "PermissionInventory",
    "PermissionInventoryEntry",
    "PermissionInventoryIssue",
    "PermissionObservedEntry",
]
