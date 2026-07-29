from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
import json
from pathlib import Path
import shutil
from uuid import uuid4

from skill_manager.directory_links import (
    create_directory_link,
    is_directory_link,
    remove_directory_link,
    resolve_directory_link,
)
from skill_manager.errors import MutationError
from skill_manager.harness import (
    FileTreeAvailability,
    FileTreeBindingProfile,
    FileTreeLayout,
    HarnessKernelService,
)
from skill_manager.harness.availability import any_command_is_available
from skill_manager.platform_context import PlatformName

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
        install_probes: tuple[str, ...],
        path_env: str | None,
        platform: PlatformName,
        managed_root: Path,
        discovery_roots: tuple["_ResolvedRoot", ...],
        availability: FileTreeAvailability,
        app_probe_paths: tuple[Path, ...],
        layout: FileTreeLayout = "flat",
        default_category: str | None = None,
    ) -> None:
        self.harness = harness
        self.label = label
        self.logo_key = logo_key
        self._install_probes = install_probes
        self._path_env = path_env
        self._platform = platform
        self.managed_root = managed_root
        self._discovery_roots = self._dedupe_roots(discovery_roots)
        self._availability = availability
        self._app_probe_paths = app_probe_paths
        self._layout = layout
        self._default_category = default_category or "skill-manager"

    def status(self) -> SkillsHarnessStatus:
        return SkillsHarnessStatus(
            harness=self.harness,
            label=self.label,
            logo_key=self.logo_key,
            installed=self._is_installed(),
            managed_root=self.managed_root,
        )

    def scan(self) -> SkillsHarnessScan:
        hermes_policy = (
            _hermes_scan_policy(self.managed_root) if self.harness == "hermes" else None
        )
        observations, skipped_skill_names = _scan_skill_roots(
            harness=self.harness,
            label=self.label,
            roots=self._discovery_roots,
            excluded_skill_names=(
                hermes_policy.excluded_skill_names if hermes_policy is not None else frozenset()
            ),
            hermes_policy=hermes_policy,
            managed_category=self._default_category,
        )
        excluded_skill_names = set(skipped_skill_names)
        if hermes_policy is not None:
            excluded_skill_names.update(hermes_policy.excluded_skill_names)
        return SkillsHarnessScan(
            harness=self.harness,
            label=self.label,
            logo_key=self.logo_key,
            installed=self._is_installed(),
            skills=tuple(observations),
            excluded_skill_names=tuple(sorted(excluded_skill_names)),
        )

    def enable_shared_package(self, package_path: Path) -> None:
        resolved_target = package_path.resolve()
        link = self._binding_path(package_path.name)
        if is_directory_link(link):
            if resolve_directory_link(link) == resolved_target:
                return
            raise MutationError(
                f"directory link already exists but points to "
                f"{resolve_directory_link(link)}, not {resolved_target}"
            )
        if link.exists():
            raise MutationError(f"real directory exists at {link}; will not overwrite")
        try:
            create_directory_link(link, resolved_target)
        except OSError as error:
            raise MutationError(f"unable to create managed directory link at {link}: {error}") from error

    def disable_shared_package(self, package_dir: str) -> None:
        link = self._binding_path(package_dir)
        if not link.exists() and not is_directory_link(link):
            return
        if not is_directory_link(link):
            raise MutationError(
                f"not a symlink or directory junction at {link}; will not delete real directory"
            )
        remove_directory_link(link)

    def adopt_local_copy(self, existing_dir: Path, package_path: Path) -> None:
        resolved_target = package_path.resolve()
        if not existing_dir.exists() and not is_directory_link(existing_dir):
            raise MutationError(f"directory does not exist: {existing_dir}")
        if is_directory_link(existing_dir):
            if resolve_directory_link(existing_dir) == resolved_target:
                return
            raise MutationError(
                f"directory link exists but points to "
                f"{resolve_directory_link(existing_dir)}, not {resolved_target}"
            )

        preflight_link = existing_dir.parent / f".{existing_dir.name}.preflight-{uuid4().hex}"
        backup_dir = existing_dir.parent / f".{existing_dir.name}.backup-{uuid4().hex}"
        try:
            create_directory_link(preflight_link, resolved_target)
            remove_directory_link(preflight_link)
            existing_dir.rename(backup_dir)
            create_directory_link(existing_dir, resolved_target)
        except OSError as error:
            if is_directory_link(preflight_link):
                remove_directory_link(preflight_link)
            if is_directory_link(existing_dir):
                remove_directory_link(existing_dir)
            if backup_dir.exists() and not existing_dir.exists():
                backup_dir.rename(existing_dir)
            raise MutationError(f"unable to adopt local copy at {existing_dir}: {error}") from error

        shutil.rmtree(backup_dir)

    def has_binding(self, package_dir: str) -> bool:
        candidate = self._binding_path(package_dir)
        return candidate.exists() or is_directory_link(candidate)

    def prepare_materialize(self, package_dir: str, expected_target: Path) -> None:
        existing_link = self._binding_path(package_dir)
        if not existing_link.exists() and not is_directory_link(existing_link):
            raise MutationError(f"directory does not exist: {existing_link}")
        if not is_directory_link(existing_link):
            raise MutationError(
                f"not a symlink or directory junction at {existing_link}; "
                "will not overwrite real directory"
            )
        resolved_target = expected_target.resolve()
        if resolve_directory_link(existing_link) != resolved_target:
            raise MutationError(
                f"directory link exists but points to "
                f"{resolve_directory_link(existing_link)}, not {resolved_target}"
            )

    def materialize_binding(self, package_dir: str, source_path: Path) -> None:
        existing_link = self._binding_path(package_dir)
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

        if is_directory_link(backup_link):
            remove_directory_link(backup_link)

    def prepare_remove(self, package_dir: str) -> None:
        link = self._binding_path(package_dir)
        if not link.exists() and not is_directory_link(link):
            return
        if not is_directory_link(link):
            raise MutationError(
                f"not a symlink or directory junction at {link}; will not delete real directory"
            )

    def remove_binding(self, package_dir: str) -> None:
        self.disable_shared_package(package_dir)

    def _binding_path(self, package_dir: str) -> Path:
        default = self._default_binding_path(package_dir)
        if default.exists() or is_directory_link(default):
            return default
        if self._layout != "categorized" or not self.managed_root.is_dir():
            return default
        for category_dir in sorted(self.managed_root.iterdir(), key=lambda path: path.name):
            if not category_dir.is_dir() or category_dir.name.startswith("."):
                continue
            candidate = category_dir / package_dir
            if is_directory_link(candidate):
                return candidate
        return default

    def _default_binding_path(self, package_dir: str) -> Path:
        if self._layout == "categorized":
            return self.managed_root / self._default_category / package_dir
        return self.managed_root / package_dir

    def invalidate(self) -> None:
        return None

    def _is_installed(self) -> bool:
        cli_available = any_command_is_available(
            self._install_probes,
            path_env=self._path_env,
            platform=self._platform,
        )
        if self._availability == "cli":
            return cli_available
        if self._availability == "cli_or_app":
            return cli_available or any(path.exists() for path in self._app_probe_paths)
        return cli_available

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
    layout: FileTreeLayout = "flat"


@dataclass(frozen=True)
class _HermesScanPolicy:
    # Non-official Hermes hub installs are the only real Hermes directories
    # Skill Manager should adopt. Local/self-learned Hermes skills are too
    # runtime-specific; bundled and official optional skills are Hermes-owned.
    external_sources: dict[str, SourceDescriptor]
    excluded_skill_names: frozenset[str]


def _iter_skill_roots(root: _ResolvedRoot):
    if root.layout == "flat":
        for skill_root in find_skill_roots(root.path):
            yield skill_root, skill_root.name
        return
    if not root.path.is_dir():
        return
    for category_dir in sorted(root.path.iterdir(), key=lambda path: path.name):
        if not category_dir.is_dir() or category_dir.name.startswith("."):
            continue
        for skill_root in find_skill_roots(category_dir):
            yield skill_root, f"{category_dir.name}/{skill_root.name}"


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
                layout=profile.layout,
            ),
            *tuple(
                _ResolvedRoot(
                    kind=root.kind,
                    scope=root.scope,
                    label=root.label,
                    path=root.path_resolver(kernel.context),
                    layout=profile.layout,
                )
                for root in profile.discovery_roots
            ),
        )
        adapters.append(
            FileTreeSkillsAdapter(
                harness=definition.harness,
                label=definition.label,
                logo_key=definition.logo_key,
                install_probes=definition.install_probes_for(kernel.context.platform),
                path_env=kernel.context.env.get("PATH"),
                platform=kernel.context.platform,
                managed_root=managed_root,
                discovery_roots=resolved_roots,
                availability=profile.availability,
                app_probe_paths=tuple(
                    resolver(kernel.context) for resolver in profile.app_probe_paths
                ),
                layout=profile.layout,
                default_category=profile.default_category,
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
    excluded_skill_names: frozenset[str] = frozenset(),
    hermes_policy: _HermesScanPolicy | None = None,
    managed_category: str = "skill-manager",
) -> tuple[list[SkillObservation], set[str]]:
    observations: list[SkillObservation] = []
    skipped_skill_names: set[str] = set()
    for root in roots:
        for skill_root, locator_name in _iter_skill_roots(root):
            hermes_source = _hermes_external_source(
                hermes_policy,
                package_name=None,
                package_dir=skill_root.name,
                locator_name=locator_name,
            )
            is_skill_manager_binding = (
                hermes_policy is not None
                and _is_skill_manager_hermes_binding(
                    skill_root=skill_root,
                    locator_name=locator_name,
                    managed_category=managed_category,
                )
            )
            if hermes_policy is not None and hermes_source is None and not is_skill_manager_binding:
                _record_excluded_skill(
                    skipped_skill_names,
                    package_name=None,
                    package_dir=skill_root.name,
                    locator_name=locator_name,
                )
                continue

            default_source = SourceDescriptor(
                kind="harness-local",
                locator=f"{harness}:{root.scope}:{locator_name}",
            )
            if hermes_source is not None:
                default_source = hermes_source
            try:
                package = parse_skill_package(skill_root, default_source=default_source)
            except SkillParseError:
                continue

            if hermes_policy is not None:
                if not is_skill_manager_binding and _is_excluded_skill(
                    package_name=package.declared_name,
                    package_dir=skill_root.name,
                    locator_name=locator_name,
                    excluded_skill_names=excluded_skill_names,
                ):
                    _record_excluded_skill(
                        skipped_skill_names,
                        package_name=package.declared_name,
                        package_dir=skill_root.name,
                        locator_name=locator_name,
                    )
                    continue

                hermes_source = hermes_source or _hermes_external_source(
                    hermes_policy,
                    package_name=package.declared_name,
                    package_dir=skill_root.name,
                    locator_name=locator_name,
                )
                if hermes_source is not None and package.source.kind == "harness-local":
                    try:
                        package = parse_skill_package(skill_root, default_source=hermes_source)
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
    return observations, skipped_skill_names


def _hermes_scan_policy(skills_root: Path) -> _HermesScanPolicy:
    excluded_names: set[str] = set()
    external_sources: dict[str, SourceDescriptor] = {}
    _read_hermes_bundled_manifest(skills_root / ".bundled_manifest", excluded_names)
    _read_hermes_hub_lock(
        skills_root / ".hub" / "lock.json",
        excluded_names=excluded_names,
        external_sources=external_sources,
    )
    return _HermesScanPolicy(
        external_sources=external_sources,
        excluded_skill_names=frozenset(name for name in excluded_names if name),
    )


def _read_hermes_bundled_manifest(path: Path, names: set[str]) -> None:
    if not path.is_file():
        return
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return
    for line in lines:
        name = line.strip().partition(":")[0].strip()
        if name:
            names.add(name)


def _read_hermes_hub_lock(
    path: Path,
    *,
    excluded_names: set[str],
    external_sources: dict[str, SourceDescriptor],
) -> None:
    if not path.is_file():
        return
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return
    installed = payload.get("installed", {})
    if not isinstance(installed, dict):
        return
    for lock_name, raw_entry in installed.items():
        if not isinstance(raw_entry, dict):
            continue
        install_path = raw_entry.get("install_path")
        names = _hermes_lock_names(str(lock_name), install_path)
        if _is_hermes_official_lock_entry(raw_entry):
            excluded_names.update(names)
            continue
        source = str(raw_entry.get("source", "")).strip() or "hermes-hub"
        identifier = str(raw_entry.get("identifier", "")).strip() or str(lock_name)
        descriptor = SourceDescriptor(kind=source, locator=identifier)
        for name in names:
            external_sources[name] = descriptor


def _is_hermes_official_lock_entry(raw_entry: dict[str, object]) -> bool:
    metadata = raw_entry.get("metadata", {})
    source = str(raw_entry.get("source", ""))
    identifier = str(raw_entry.get("identifier", ""))
    trust_level = str(raw_entry.get("trust_level", ""))
    return (
        source == "official"
        or identifier.startswith("official/")
        or trust_level == "builtin"
        or (isinstance(metadata, dict) and metadata.get("backfilled_from") == "optional-skills")
    )


def _hermes_lock_names(lock_name: str, install_path: object) -> set[str]:
    names = {lock_name} if lock_name else set()
    if isinstance(install_path, str) and install_path:
        names.add(install_path)
        names.add(Path(install_path).name)
    return {name for name in names if name}


def _hermes_external_source(
    hermes_policy: _HermesScanPolicy | None,
    *,
    package_name: str | None,
    package_dir: str,
    locator_name: str,
) -> SourceDescriptor | None:
    if hermes_policy is None:
        return None
    locator_leaf = Path(locator_name).name
    for candidate in (package_name, locator_name, package_dir, locator_leaf):
        if candidate and candidate in hermes_policy.external_sources:
            return hermes_policy.external_sources[candidate]
    return None


def _is_skill_manager_hermes_binding(
    *,
    skill_root: Path,
    locator_name: str,
    managed_category: str,
) -> bool:
    return is_directory_link(skill_root) and locator_name.startswith(f"{managed_category}/")


def _record_excluded_skill(
    names: set[str],
    *,
    package_name: str | None,
    package_dir: str,
    locator_name: str,
) -> None:
    locator_leaf = Path(locator_name).name
    for candidate in (package_name, package_dir, locator_name, locator_leaf):
        if candidate:
            names.add(candidate)


def _is_excluded_skill(
    *,
    package_name: str | None,
    package_dir: str,
    locator_name: str,
    excluded_skill_names: frozenset[str],
) -> bool:
    if not excluded_skill_names:
        return False
    locator_leaf = Path(locator_name).name
    return any(
        candidate in excluded_skill_names
        for candidate in (package_name, package_dir, locator_name, locator_leaf)
        if candidate
    )


__all__ = ["FileTreeSkillsAdapter", "build_skills_adapters", "scan_all_adapters"]
