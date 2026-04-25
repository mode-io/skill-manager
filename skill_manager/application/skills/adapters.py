from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
import shutil
from uuid import uuid4

from skill_manager.errors import MutationError
from skill_manager.harness import (
    FileTreeBindingProfile,
    HarnessKernelService,
)

from .contracts import SkillsHarnessAdapter, SkillsHarnessStatus
from .identity import SourceDescriptor
from .observations import SkillObservation, SkillsHarnessScan
from .package import SkillParseError, find_skill_roots, parse_skill_package


class FileTreeSkillsAdapter(SkillsHarnessAdapter):
    def __init__(
        self,
        *,
        harness: str,
        label: str,
        logo_key: str | None,
        install_probe: str,
        path_env: str | None,
        managed_root: Path,
        discovery_roots: tuple["_ResolvedRoot", ...],
    ) -> None:
        self.harness = harness
        self.label = label
        self.logo_key = logo_key
        self._install_probe = install_probe
        self._path_env = path_env
        self.managed_root = managed_root
        self._discovery_roots = self._dedupe_roots(discovery_roots)

    def status(self) -> SkillsHarnessStatus:
        return SkillsHarnessStatus(
            harness=self.harness,
            label=self.label,
            logo_key=self.logo_key,
            installed=self._is_installed(),
            managed_root=self.managed_root,
        )

    def scan(self) -> SkillsHarnessScan:
        observations = _scan_skill_roots(
            harness=self.harness,
            label=self.label,
            roots=self._discovery_roots,
        )
        return SkillsHarnessScan(
            harness=self.harness,
            label=self.label,
            logo_key=self.logo_key,
            installed=self._is_installed(),
            skills=tuple(observations),
        )

    def enable_shared_package(self, package_path: Path) -> None:
        resolved_target = package_path.resolve()
        link = self.managed_root / package_path.name
        if link.is_symlink():
            if link.resolve() == resolved_target:
                return
            raise MutationError(
                f"symlink already exists but points to {link.resolve()}, not {resolved_target}"
            )
        if link.exists():
            raise MutationError(f"real directory exists at {link}; will not overwrite")
        self.managed_root.mkdir(parents=True, exist_ok=True)
        link.symlink_to(resolved_target)

    def disable_shared_package(self, package_dir: str) -> None:
        link = self.managed_root / package_dir
        if not link.exists() and not link.is_symlink():
            return
        if not link.is_symlink():
            raise MutationError(f"not a symlink at {link}; will not delete real directory")
        link.unlink()

    def adopt_local_copy(self, existing_dir: Path, package_path: Path) -> None:
        resolved_target = package_path.resolve()
        if not existing_dir.exists() and not existing_dir.is_symlink():
            raise MutationError(f"directory does not exist: {existing_dir}")
        if existing_dir.is_symlink():
            if existing_dir.resolve() == resolved_target:
                return
            raise MutationError(
                f"symlink exists but points to {existing_dir.resolve()}, not {resolved_target}"
            )
        shutil.rmtree(existing_dir)
        existing_dir.symlink_to(resolved_target)

    def has_binding(self, package_dir: str) -> bool:
        candidate = self.managed_root / package_dir
        return candidate.exists() or candidate.is_symlink()

    def prepare_materialize(self, package_dir: str, expected_target: Path) -> None:
        existing_link = self.managed_root / package_dir
        if not existing_link.exists() and not existing_link.is_symlink():
            raise MutationError(f"directory does not exist: {existing_link}")
        if not existing_link.is_symlink():
            raise MutationError(f"not a symlink at {existing_link}; will not overwrite real directory")
        resolved_target = expected_target.resolve()
        if existing_link.resolve() != resolved_target:
            raise MutationError(
                f"symlink exists but points to {existing_link.resolve()}, not {resolved_target}"
            )

    def materialize_binding(self, package_dir: str, source_path: Path) -> None:
        existing_link = self.managed_root / package_dir
        resolved_target = source_path.resolve()
        self.prepare_materialize(package_dir=package_dir, expected_target=resolved_target)

        temp_copy = existing_link.parent / f".{existing_link.name}.materialize-{uuid4().hex}"
        backup_link = existing_link.parent / f".{existing_link.name}.backup-{uuid4().hex}"

        try:
            shutil.copytree(resolved_target, temp_copy)
            existing_link.rename(backup_link)
            temp_copy.rename(existing_link)
        except OSError as error:
            if backup_link.exists() and not existing_link.exists():
                backup_link.rename(existing_link)
            if temp_copy.exists():
                shutil.rmtree(temp_copy, ignore_errors=True)
            raise MutationError(f"unable to restore local copy at {existing_link}: {error}") from error

        if backup_link.exists():
            backup_link.unlink()

    def prepare_remove(self, package_dir: str) -> None:
        link = self.managed_root / package_dir
        if not link.exists() and not link.is_symlink():
            return
        if not link.is_symlink():
            raise MutationError(f"not a symlink at {link}; will not delete real directory")

    def remove_binding(self, package_dir: str) -> None:
        self.disable_shared_package(package_dir)

    def invalidate(self) -> None:
        return None

    def _is_installed(self) -> bool:
        return shutil.which(self._install_probe, path=self._path_env) is not None

    def _dedupe_roots(
        self,
        roots: tuple["_ResolvedRoot", ...],
    ) -> tuple["_ResolvedRoot", ...]:
        selected: list[_ResolvedRoot] = []
        seen: set[Path] = set()
        for root in roots:
            path = root.path.resolve(strict=False)
            if path in seen:
                continue
            seen.add(path)
            selected.append(root)
        return tuple(selected)


@dataclass(frozen=True)
class _ResolvedRoot:
    kind: str
    scope: str
    label: str
    path: Path


def build_skills_adapters(kernel: HarnessKernelService) -> tuple[FileTreeSkillsAdapter, ...]:
    adapters: list[FileTreeSkillsAdapter] = []
    for binding in kernel.bindings_for_family("skills"):
        definition = binding.definition
        profile = binding.profile
        if not isinstance(profile, FileTreeBindingProfile):
            continue
        managed_root = profile.resolve_managed_root(kernel.context)
        resolved_roots = (
            _ResolvedRoot(
                kind="managed-root",
                scope="canonical",
                label="Managed skills root",
                path=managed_root,
            ),
            *tuple(
                _ResolvedRoot(
                    kind=root.kind,
                    scope=root.scope,
                    label=root.label,
                    path=root.path_resolver(kernel.context),
                )
                for root in profile.discovery_roots
            ),
        )
        adapters.append(
            FileTreeSkillsAdapter(
                harness=definition.harness,
                label=definition.label,
                logo_key=definition.logo_key,
                install_probe=definition.install_probe,
                path_env=kernel.context.env.get("PATH"),
                managed_root=managed_root,
                discovery_roots=resolved_roots,
            )
        )
    return tuple(adapters)


def scan_all_adapters(adapters: tuple[SkillsHarnessAdapter, ...]) -> tuple[SkillsHarnessScan, ...]:
    if not adapters:
        return ()
    with ThreadPoolExecutor(max_workers=len(adapters)) as executor:
        return tuple(executor.map(lambda adapter: adapter.scan(), adapters))


def _scan_skill_roots(
    *,
    harness: str,
    label: str,
    roots: tuple[_ResolvedRoot, ...],
) -> list[SkillObservation]:
    observations: list[SkillObservation] = []
    for root in roots:
        for skill_root in find_skill_roots(root.path):
            try:
                package = parse_skill_package(
                    skill_root,
                    default_source=SourceDescriptor(
                        kind="harness-local",
                        locator=f"{harness}:{root.scope}:{skill_root.name}",
                    ),
                )
            except SkillParseError:
                continue
            observations.append(
                SkillObservation(
                    harness=harness,
                    label=label,
                    scope=root.scope,
                    package=package,
                )
            )
    return observations


__all__ = ["FileTreeSkillsAdapter", "build_skills_adapters", "scan_all_adapters"]
