from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Protocol

from .store import McpServerSpec


BindingState = Literal["managed", "drifted", "unmanaged", "missing"]


@dataclass(frozen=True)
class McpHarnessStatus:
    harness: str
    label: str
    logo_key: str | None
    installed: bool
    config_path: Path
    config_present: bool
    mcp_writable: bool = True
    mcp_unavailable_reason: str | None = None


@dataclass(frozen=True)
class McpObservedEntry:
    name: str
    state: BindingState
    raw_payload: dict[str, object] | None = None
    parsed_spec: McpServerSpec | None = None
    drift_detail: str | None = None
    parse_issue: str | None = None


@dataclass(frozen=True)
class McpBinding:
    harness: str
    name: str
    state: BindingState
    drift_detail: str | None = None


@dataclass(frozen=True)
class McpHarnessScan:
    harness: str
    label: str
    logo_key: str | None
    installed: bool
    config_present: bool
    config_path: Path
    mcp_writable: bool = True
    mcp_unavailable_reason: str | None = None
    scan_issue: str | None = None
    entries: tuple[McpObservedEntry, ...] = ()


@dataclass(frozen=True)
class McpInventoryEntry:
    name: str
    display_name: str
    spec: McpServerSpec | None
    sightings: tuple[McpBinding, ...]
    is_managed: bool
    can_enable: bool = True

    @property
    def kind(self) -> str:
        return "managed" if self.is_managed else "unmanaged"


@dataclass(frozen=True)
class McpInventoryIssue:
    name: str
    reason: str


@dataclass(frozen=True)
class McpInventory:
    columns: tuple[str, ...]
    entries: tuple[McpInventoryEntry, ...]
    issues: tuple[McpInventoryIssue, ...] = ()


class McpHarnessAdapter(Protocol):
    harness: str
    label: str
    logo_key: str | None
    config_path: Path

    def status(self) -> McpHarnessStatus: ...

    def scan(self, specs: tuple[McpServerSpec, ...]) -> McpHarnessScan: ...

    def has_binding(self, name: str) -> bool: ...

    def enable_server(self, spec: McpServerSpec) -> None: ...

    def disable_server(self, name: str) -> None: ...

    def invalidate(self) -> None: ...


__all__ = [
    "BindingState",
    "McpBinding",
    "McpHarnessAdapter",
    "McpHarnessScan",
    "McpHarnessStatus",
    "McpInventory",
    "McpInventoryEntry",
    "McpInventoryIssue",
    "McpObservedEntry",
]
