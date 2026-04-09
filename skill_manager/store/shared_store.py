from __future__ import annotations

import shutil
from pathlib import Path

from skill_manager.domain import (
    CheckIssue,
    SourceDescriptor,
    StorePackageObservation,
    StoreScan,
    find_skill_roots,
    fingerprint_package,
    parse_skill_package,
)

from .manifest import ManifestEntry, StoreManifest, load_manifest, write_manifest


def default_shared_store_root(env: dict[str, str] | None = None) -> Path:
    active_env = env or {}
    home = Path(active_env.get("HOME", str(Path.home())))
    xdg_data_home = Path(active_env.get("XDG_DATA_HOME", home / ".local" / "share"))
    return xdg_data_home / "skill-manager" / "shared"


class SharedStore:
    def __init__(self, root: Path, manifest_path: Path | None = None) -> None:
        self.root = root
        self.manifest_path = manifest_path or root.parent / "manifest.json"

    def scan(self) -> StoreScan:
        manifest = load_manifest(self.manifest_path)
        manifest_index = {entry.package_dir: entry for entry in manifest.entries}
        packages = []
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
                )
            )
        return StoreScan(packages=tuple(packages), issues=tuple(issue.message for issue in self.check_integrity()))

    def ingest(
        self,
        *,
        source_path: Path,
        declared_name: str,
        source_kind: str,
        source_locator: str,
    ) -> Path:
        """Copy a skill package into the shared store and update the manifest."""
        self.root.mkdir(parents=True, exist_ok=True)
        dest = self.root / source_path.name
        if dest.exists():
            raise ValueError(f"package directory already exists in store: {source_path.name}")
        shutil.copytree(source_path, dest)
        fingerprint, _ = fingerprint_package(dest)
        manifest = load_manifest(self.manifest_path)
        entry = ManifestEntry(
            package_dir=source_path.name,
            declared_name=declared_name,
            source_kind=source_kind,
            source_locator=source_locator,
            revision=fingerprint,
        )
        write_manifest(self.manifest_path, StoreManifest(entries=manifest.entries + (entry,)))
        return dest

    def update(self, package_dir: str, *, source_path: Path) -> tuple[Path, bool]:
        """Replace a shared package with a new version. Returns (path, changed)."""
        dest = self.root / package_dir
        if not dest.is_dir():
            raise ValueError(f"package not in store: {package_dir}")
        new_fp, _ = fingerprint_package(source_path)
        old_fp, _ = fingerprint_package(dest)
        if new_fp == old_fp:
            return dest, False
        shutil.rmtree(dest)
        shutil.copytree(source_path, dest)
        manifest = load_manifest(self.manifest_path)
        updated = tuple(
            ManifestEntry(e.package_dir, e.declared_name, e.source_kind, e.source_locator, new_fp)
            if e.package_dir == package_dir
            else e
            for e in manifest.entries
        )
        write_manifest(self.manifest_path, StoreManifest(entries=updated))
        return dest, True

    def delete(self, package_dir: str) -> None:
        self.ensure_deletable(package_dir)
        dest = self.root / package_dir
        manifest = load_manifest(self.manifest_path)
        shutil.rmtree(dest)
        updated = tuple(entry for entry in manifest.entries if entry.package_dir != package_dir)
        write_manifest(self.manifest_path, StoreManifest(entries=updated))

    def ensure_deletable(self, package_dir: str) -> None:
        dest = self.root / package_dir
        if not dest.is_dir():
            raise ValueError(f"package not in store: {package_dir}")
        manifest = load_manifest(self.manifest_path)
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
