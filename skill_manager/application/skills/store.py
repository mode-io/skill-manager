from __future__ import annotations

import shutil
from pathlib import Path

from skill_manager.atomic_files import file_lock

from .health import CheckIssue
from .identity import SourceDescriptor
from .manifest import (
    SkillStoreEntry,
    SkillStoreManifest,
    load_skill_store_manifest,
    write_skill_store_manifest,
)
from .observations import SkillStoreScan, StorePackageObservation
from .package import find_skill_roots, fingerprint_package, parse_skill_package


class SkillStore:
    def __init__(self, root: Path, manifest_path: Path | None = None) -> None:
        self.root = root
        self.manifest_path = manifest_path or root.parent / "manifest.json"

    @property
    def lock_path(self) -> Path:
        return self.manifest_path.with_suffix(".lock")

    def scan(self) -> SkillStoreScan:
        manifest = load_skill_store_manifest(self.manifest_path)
        manifest_index = {entry.package_dir: entry for entry in manifest.entries}
        packages: list[StorePackageObservation] = []
        for path in find_skill_roots(self.root):
            entry = manifest_index.get(path.name)
            source = SourceDescriptor(
                kind=entry.source_kind if entry else "shared-store",
                locator=entry.source_locator if entry else f"shared-store:{path.name}",
            )
            packages.append(
                StorePackageObservation(
                    package=parse_skill_package(path, default_source=source),
                    recorded_revision=entry.revision if entry else None,
                    recorded_source_ref=entry.source_ref if entry else None,
                    recorded_source_path=entry.source_path if entry else None,
                )
            )
        return SkillStoreScan(
            packages=tuple(packages),
            issues=tuple(issue.message for issue in self.check_integrity()),
        )

    def ingest(
        self,
        *,
        source_path: Path,
        declared_name: str,
        source_kind: str,
        source_locator: str,
        source_ref: str | None = None,
        source_path_hint: str | None = None,
    ) -> Path:
        self.root.mkdir(parents=True, exist_ok=True)
        with file_lock(self.lock_path):
            dest = self.root / source_path.name
            if dest.exists():
                raise ValueError(f"package directory already exists in store: {source_path.name}")
            shutil.copytree(source_path, dest)
            fingerprint, _ = fingerprint_package(dest)
            manifest = load_skill_store_manifest(self.manifest_path)
            entry = SkillStoreEntry(
                package_dir=source_path.name,
                declared_name=declared_name,
                source_kind=source_kind,
                source_locator=source_locator,
                revision=fingerprint,
                source_ref=source_ref,
                source_path=source_path_hint,
            )
            write_skill_store_manifest(
                self.manifest_path,
                SkillStoreManifest(entries=manifest.entries + (entry,)),
            )
            return dest

    def update(
        self,
        package_dir: str,
        *,
        source_path: Path,
        source_ref: str | None = None,
        source_path_hint: str | None = None,
    ) -> tuple[Path, bool]:
        with file_lock(self.lock_path):
            dest = self.root / package_dir
            if not dest.is_dir():
                raise ValueError(f"package not in store: {package_dir}")
            new_fp, _ = fingerprint_package(source_path)
            old_fp, _ = fingerprint_package(dest)
            if new_fp == old_fp:
                return dest, False
            shutil.rmtree(dest)
            shutil.copytree(source_path, dest)
            manifest = load_skill_store_manifest(self.manifest_path)
            updated = tuple(
                SkillStoreEntry(
                    e.package_dir,
                    e.declared_name,
                    e.source_kind,
                    e.source_locator,
                    new_fp,
                    e.source_ref if source_ref is None else source_ref,
                    e.source_path if source_path_hint is None else source_path_hint,
                )
                if e.package_dir == package_dir
                else e
                for e in manifest.entries
            )
            write_skill_store_manifest(
                self.manifest_path,
                SkillStoreManifest(entries=updated),
            )
            return dest, True

    def delete(self, package_dir: str) -> None:
        with file_lock(self.lock_path):
            self.ensure_deletable(package_dir)
            dest = self.root / package_dir
            manifest = load_skill_store_manifest(self.manifest_path)
            shutil.rmtree(dest)
            updated = tuple(entry for entry in manifest.entries if entry.package_dir != package_dir)
            write_skill_store_manifest(
                self.manifest_path,
                SkillStoreManifest(entries=updated),
            )

    def ensure_deletable(self, package_dir: str) -> None:
        dest = self.root / package_dir
        if not dest.is_dir():
            raise ValueError(f"package not in store: {package_dir}")
        manifest = load_skill_store_manifest(self.manifest_path)
        if not any(entry.package_dir == package_dir for entry in manifest.entries):
            raise ValueError(f"package missing from manifest: {package_dir}")

    def check_integrity(self) -> tuple[CheckIssue, ...]:
        issues: list[CheckIssue] = []
        if not self.root.exists():
            return ()
        for path in sorted(self.root.iterdir()):
            if path.is_dir() and not (path / "SKILL.md").is_file():
                issues.append(
                    CheckIssue(
                        severity="error",
                        code="shared-missing-skill-md",
                        message=f"Shared package is missing SKILL.md: {path.name}",
                    )
                )
        return tuple(issues)


__all__ = ["SkillStore"]
