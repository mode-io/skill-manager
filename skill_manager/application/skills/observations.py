from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .package import SkillPackage


@dataclass(frozen=True)
class SkillObservation:
    harness: str
    label: str
    scope: str
    package: SkillPackage


@dataclass(frozen=True)
class StorePackageObservation:
    package: SkillPackage
    recorded_revision: str | None = None
    recorded_source_ref: str | None = None
    recorded_source_path: str | None = None


@dataclass(frozen=True)
class SkillsHarnessScan:
    harness: str
    label: str
    logo_key: str | None
    installed: bool
    skills: tuple[SkillObservation, ...] = ()


@dataclass(frozen=True)
class SkillStoreScan:
    packages: tuple[StorePackageObservation, ...] = ()
    issues: tuple[str, ...] = ()


__all__ = [
    "SkillObservation",
    "SkillStoreScan",
    "SkillsHarnessScan",
    "StorePackageObservation",
]
