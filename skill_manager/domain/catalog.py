from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from .identity import SkillRef, SourceDescriptor, stable_id
from .observations import BuiltinObservation, HarnessScan, SkillObservation, StoreScan


OwnershipType = Literal["shared", "unmanaged", "builtin"]


@dataclass(frozen=True)
class HarnessBinding:
    harness: str
    label: str
    state: Literal["enabled", "disabled"]
    scopes: tuple[str, ...] = ()


@dataclass(frozen=True)
class CatalogConflict:
    conflict_type: str
    message: str
    revisions: tuple[str, ...] = ()
    harnesses: tuple[str, ...] = ()


@dataclass(frozen=True)
class CatalogSighting:
    kind: Literal["shared", "harness", "builtin"]
    harness: str | None
    label: str
    scope: str | None
    package_path: Path | None
    revision: str
    source: SourceDescriptor


@dataclass(frozen=True)
class CatalogEntry:
    skill_ref: str
    logical_ref: SkillRef
    declared_name: str
    ownership: OwnershipType
    source: SourceDescriptor
    primary_revision: str
    bindings: tuple[HarnessBinding, ...] = ()
    builtin_harnesses: tuple[str, ...] = ()
    sightings: tuple[CatalogSighting, ...] = ()
    conflicts: tuple[CatalogConflict, ...] = ()
    issues: tuple[str, ...] = ()


class CatalogAssembler:
    def assemble(self, *, store_scan: StoreScan, harness_scans: tuple[HarnessScan, ...]) -> tuple[CatalogEntry, ...]:
        buckets: dict[tuple[OwnershipType, str], _Bucket] = {}

        for package in store_scan.packages:
            logical_ref = package.ref
            key = ("shared", logical_ref.value)
            bucket = buckets.setdefault(
                key,
                _Bucket(
                    ownership="shared",
                    logical_ref=logical_ref,
                    declared_name=package.declared_name,
                    source=package.source,
                ),
            )
            bucket.sightings.append(
                CatalogSighting(
                    kind="shared",
                    harness=None,
                    label="Shared Store",
                    scope=None,
                    package_path=package.root_path,
                    revision=package.revision.fingerprint,
                    source=package.source,
                )
            )
            bucket.revisions.add(package.revision.fingerprint)

        for scan in harness_scans:
            for observation in scan.skills:
                logical_ref = _resolve_unmanaged_logical_ref(observation)
                key = ("unmanaged", logical_ref.value)
                bucket = buckets.setdefault(
                    key,
                    _Bucket(
                        ownership="unmanaged",
                        logical_ref=logical_ref,
                        declared_name=observation.package.declared_name,
                        source=logical_ref.source,
                    ),
                )
                bucket.skill_observations.append(observation)
                bucket.sightings.append(
                    CatalogSighting(
                        kind="harness",
                        harness=observation.harness,
                        label=observation.label,
                        scope=observation.scope,
                        package_path=observation.package.root_path,
                        revision=observation.package.revision.fingerprint,
                        source=observation.package.source,
                    )
                )
                bucket.revisions.add(observation.package.revision.fingerprint)
                bucket.harness_scopes[observation.harness].add(observation.scope)
                bucket.harness_labels[observation.harness] = observation.label

            for builtin in scan.builtins:
                source = SourceDescriptor(kind="builtin", locator=f"{builtin.harness}:{builtin.builtin_id}")
                logical_ref = SkillRef(source=source, declared_name=builtin.declared_name)
                key = ("builtin", stable_id(builtin.harness, builtin.builtin_id))
                bucket = buckets.setdefault(
                    key,
                    _Bucket(
                        ownership="builtin",
                        logical_ref=logical_ref,
                        declared_name=builtin.declared_name,
                        source=source,
                    ),
                )
                bucket.builtin_observations.append(builtin)
                bucket.sightings.append(
                    CatalogSighting(
                        kind="builtin",
                        harness=builtin.harness,
                        label=builtin.label,
                        scope=None,
                        package_path=None,
                        revision="builtin",
                        source=source,
                    )
                )

        entries = [bucket.to_entry() for _, bucket in sorted(buckets.items(), key=lambda item: (_ownership_order(item[0][0]), item[1].declared_name.lower(), item[1].skill_ref))]
        return tuple(entries)

    @staticmethod
    def find_entry(entries: tuple[CatalogEntry, ...], *, skill_ref: str) -> CatalogEntry | None:
        for entry in entries:
            if entry.skill_ref == skill_ref:
                return entry
        return None


class _Bucket:
    def __init__(self, *, ownership: OwnershipType, logical_ref: SkillRef, declared_name: str, source: SourceDescriptor) -> None:
        self.ownership = ownership
        self.logical_ref = logical_ref
        self.declared_name = declared_name
        self.source = source
        self.skill_ref = f"{ownership}:{logical_ref.value}"
        self.skill_observations: list[SkillObservation] = []
        self.builtin_observations: list[BuiltinObservation] = []
        self.sightings: list[CatalogSighting] = []
        self.revisions: set[str] = set()
        self.harness_scopes: dict[str, set[str]] = defaultdict(set)
        self.harness_labels: dict[str, str] = {}
        self.issues: list[str] = []

    def to_entry(self) -> CatalogEntry:
        conflicts: list[CatalogConflict] = []
        if self.ownership in {"shared", "unmanaged"} and self.logical_ref.source.is_source_backed and len(self.revisions) > 1:
            conflicts.append(
                CatalogConflict(
                    conflict_type="divergent_revision",
                    message=f"Source-backed skill copies diverged across sightings for {self.declared_name}.",
                    revisions=tuple(sorted(self.revisions)),
                    harnesses=tuple(sorted({observation.harness for observation in self.skill_observations})),
                )
            )
        bindings = tuple(
            HarnessBinding(
                harness=harness,
                label=self.harness_labels[harness],
                state="enabled",
                scopes=tuple(sorted(scopes)),
            )
            for harness, scopes in sorted(self.harness_scopes.items())
        )
        builtin_harnesses = tuple(sorted(observation.harness for observation in self.builtin_observations))
        primary_revision = "builtin" if self.ownership == "builtin" else _pick_primary_revision(self.revisions)
        return CatalogEntry(
            skill_ref=self.skill_ref,
            logical_ref=self.logical_ref,
            declared_name=self.declared_name,
            ownership=self.ownership,
            source=self.source,
            primary_revision=primary_revision,
            bindings=bindings,
            builtin_harnesses=builtin_harnesses,
            sightings=tuple(sorted(self.sightings, key=_sighting_sort_key)),
            conflicts=tuple(conflicts),
            issues=tuple(self.issues),
        )


def _resolve_unmanaged_logical_ref(observation: SkillObservation) -> SkillRef:
    package = observation.package
    if package.source.is_source_backed:
        return package.ref
    source = SourceDescriptor(
        kind="unmanaged-local",
        locator=stable_id(package.declared_name, package.revision.fingerprint),
    )
    return SkillRef(source=source, declared_name=package.declared_name)


def _pick_primary_revision(revisions: set[str]) -> str:
    if not revisions:
        return ""
    return sorted(revisions)[0]


def _ownership_order(ownership: OwnershipType) -> int:
    return {"shared": 0, "unmanaged": 1, "builtin": 2}[ownership]


def _sighting_sort_key(sighting: CatalogSighting) -> tuple[str, str, str]:
    return (sighting.kind, sighting.harness or "", sighting.scope or "")
