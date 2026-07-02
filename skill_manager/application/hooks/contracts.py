from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Protocol

from .store import HookSpec


BindingState = Literal["managed", "drifted", "unmanaged", "missing", "unsupported"]


@dataclass(frozen=True)
class HookHarnessStatus:
    harness: str
    label: str
    logo_key: str | None
    installed: bool
    config_path: Path
    config_present: bool
    hooks_writable: bool = True
    hooks_unavailable_reason: str | None = None


@dataclass(frozen=True)
class HookObservedEntry:
    id: str
    event: str
    state: BindingState
    raw_payload: dict[str, object] | None = None
    parsed_spec: HookSpec | None = None
    drift_detail: str | None = None
    parse_issue: str | None = None
    caveat: str | None = None


@dataclass(frozen=True)
class HookBinding:
    harness: str
    id: str
    state: BindingState
    drift_detail: str | None = None
    caveat: str | None = None


@dataclass(frozen=True)
class HookHarnessScan:
    harness: str
    label: str
    logo_key: str | None
    installed: bool
    config_present: bool
    config_path: Path
    hooks_writable: bool = True
    hooks_unavailable_reason: str | None = None
    scan_issue: str | None = None
    entries: tuple[HookObservedEntry, ...] = ()


@dataclass(frozen=True)
class HookInventoryEntry:
    id: str
    display_name: str
    spec: HookSpec | None
    sightings: tuple[HookBinding, ...]
    is_managed: bool
    can_enable: bool = True

    @property
    def kind(self) -> str:
        return "managed" if self.is_managed else "unmanaged"


@dataclass(frozen=True)
class HookInventoryIssue:
    name: str
    reason: str


@dataclass(frozen=True)
class HookInventory:
    columns: tuple[str, ...]
    entries: tuple[HookInventoryEntry, ...]
    issues: tuple[HookInventoryIssue, ...] = ()


class HookHarnessAdapter(Protocol):
    harness: str
    label: str
    logo_key: str | None
    config_path: Path

    def status(self) -> HookHarnessStatus: ...

    def scan(self, specs: tuple[HookSpec, ...]) -> HookHarnessScan: ...

    def has_binding(self, id: str) -> bool: ...

    def enable_hook(self, spec: HookSpec) -> None: ...

    def disable_hook(self, id: str) -> None: ...

    def invalidate(self) -> None: ...


__all__ = [
    "BindingState",
    "HookBinding",
    "HookHarnessAdapter",
    "HookHarnessScan",
    "HookHarnessStatus",
    "HookInventory",
    "HookInventoryEntry",
    "HookInventoryIssue",
    "HookObservedEntry",
]
