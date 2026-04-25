from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from .observations import SkillsHarnessScan


@dataclass(frozen=True)
class SkillsHarnessStatus:
    harness: str
    label: str
    logo_key: str | None
    installed: bool
    managed_root: Path


class SkillsHarnessAdapter(Protocol):
    harness: str
    label: str
    logo_key: str | None
    managed_root: Path

    def status(self) -> SkillsHarnessStatus: ...

    def scan(self) -> SkillsHarnessScan: ...

    def enable_shared_package(self, package_path: Path) -> None: ...

    def disable_shared_package(self, package_dir: str) -> None: ...

    def adopt_local_copy(self, existing_dir: Path, package_path: Path) -> None: ...

    def has_binding(self, package_dir: str) -> bool: ...

    def prepare_materialize(self, package_dir: str, expected_target: Path) -> None: ...

    def materialize_binding(self, package_dir: str, source_path: Path) -> None: ...

    def prepare_remove(self, package_dir: str) -> None: ...

    def remove_binding(self, package_dir: str) -> None: ...

    def invalidate(self) -> None: ...


__all__ = ["SkillsHarnessAdapter", "SkillsHarnessStatus"]
