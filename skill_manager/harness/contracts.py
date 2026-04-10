from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from skill_manager.domain import HarnessScan


@dataclass(frozen=True)
class AdapterConfig:
    harness: str
    label: str
    logo_key: str | None


@dataclass(frozen=True)
class HarnessLocation:
    kind: str
    label: str
    path: Path
    present: bool


@dataclass(frozen=True)
class HarnessStatus:
    harness: str
    label: str
    logo_key: str | None
    detected: bool
    locations: tuple[HarnessLocation, ...] = ()


class HarnessAdapter(Protocol):
    config: AdapterConfig
    managed_skills_root: Path

    def status(self) -> HarnessStatus:
        ...

    def scan(self) -> HarnessScan:
        ...

    def invalidate(self) -> None:
        ...
