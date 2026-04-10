from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from skill_manager.domain import HarnessScan


class HarnessDefinitionLike:
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


class HarnessManager(Protocol):
    managed_root: Path

    def enable_shared_package(self, package_path: Path) -> None:
        ...

    def disable_shared_package(self, package_dir: str) -> None:
        ...

    def adopt_local_copy(self, existing_dir: Path, package_path: Path) -> None:
        ...

    def has_binding(self, package_dir: str) -> bool:
        ...

    def prepare_materialize(self, package_dir: str, expected_target: Path) -> None:
        ...

    def materialize_binding(self, package_dir: str, source_path: Path) -> None:
        ...

    def prepare_remove(self, package_dir: str) -> None:
        ...

    def remove_binding(self, package_dir: str) -> None:
        ...


class HarnessDriver(Protocol):
    harness: str
    label: str
    logo_key: str | None

    def manager(self) -> HarnessManager | None:
        ...

    def status(self) -> HarnessStatus:
        ...

    def scan(self) -> HarnessScan:
        ...

    def invalidate(self) -> None:
        ...
