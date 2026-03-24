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
class BuiltinObservation:
    harness: str
    label: str
    builtin_id: str
    declared_name: str
    detail: str = ""


@dataclass(frozen=True)
class StorePackageObservation:
    package: SkillPackage
    recorded_revision: str | None = None


@dataclass(frozen=True)
class HarnessScan:
    harness: str
    label: str
    detected: bool
    manageable: bool
    builtin_support: bool
    discovery_mode: str
    detection_details: tuple[str, ...] = ()
    skills: tuple[SkillObservation, ...] = ()
    builtins: tuple[BuiltinObservation, ...] = ()
    issues: tuple[str, ...] = ()


@dataclass(frozen=True)
class StoreScan:
    packages: tuple[StorePackageObservation, ...] = ()
    issues: tuple[str, ...] = ()
