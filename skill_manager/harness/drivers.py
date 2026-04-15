from __future__ import annotations

import json
from pathlib import Path
import shutil

from skill_manager.domain import (
    BuiltinObservation,
    HarnessScan,
    SkillObservation,
    SkillParseError,
    SourceDescriptor,
    find_skill_roots,
    parse_skill_package,
)

from .contracts import HarnessDefinitionLike, HarnessDiscoveryRoot, HarnessDriver, HarnessLocation, HarnessManager, HarnessStatus
from .managers import SymlinkHarnessManager


class GlobalHarnessDriver(HarnessDriver):
    def __init__(
        self,
        *,
        definition: HarnessDefinitionLike,
        install_probe: str,
        path_env: str | None,
        discovery_roots: tuple[HarnessDiscoveryRoot, ...],
        builtins_path: Path | None,
    ) -> None:
        self.harness = definition.harness
        self.label = definition.label
        self.logo_key = definition.logo_key
        self._install_probe = install_probe
        self._path_env = path_env
        self._discovery_roots = _dedupe_roots(discovery_roots)
        self._builtins_path = builtins_path

    def manager(self) -> HarnessManager | None:
        return SymlinkHarnessManager(self._managed_root())

    def status(self) -> HarnessStatus:
        locations = [
            HarnessLocation(
                kind=root.kind,
                label=root.label,
                path=root.path,
                present=root.path.exists(),
            )
            for root in self._discovery_roots
        ]
        if self._builtins_path is not None:
            locations.append(
                HarnessLocation(
                    kind="builtins",
                    label="Builtins catalog",
                    path=self._builtins_path,
                    present=self._builtins_path.is_file(),
                )
            )
        return HarnessStatus(
            harness=self.harness,
            label=self.label,
            logo_key=self.logo_key,
            installed=self._is_installed(),
            locations=tuple(locations),
        )

    def scan(self) -> HarnessScan:
        observations = _scan_skill_roots(
            harness=self.harness,
            label=self.label,
            roots=self._discovery_roots,
        )
        builtins = tuple(_load_builtins(self.harness, self.label, self._builtins_path))
        return HarnessScan(
            harness=self.harness,
            label=self.label,
            logo_key=self.logo_key,
            installed=self._is_installed(),
            manageable=self.manager() is not None,
            skills=tuple(observations),
            builtins=builtins,
        )

    def invalidate(self) -> None:
        return None

    def _managed_root(self) -> Path:
        return next(root.path for root in self._discovery_roots if root.writable)

    def _is_installed(self) -> bool:
        return shutil.which(self._install_probe, path=self._path_env) is not None


def _scan_skill_roots(
    *,
    harness: str,
    label: str,
    roots: tuple[HarnessDiscoveryRoot, ...],
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


def _load_builtins(harness: str, label: str, builtins_path: Path | None) -> list[BuiltinObservation]:
    if builtins_path is None or not builtins_path.is_file():
        return []
    payload = json.loads(builtins_path.read_text(encoding="utf-8"))
    builtins: list[BuiltinObservation] = []
    for item in payload.get("builtins", payload.get("skills", [])):
        builtins.append(
            BuiltinObservation(
                harness=harness,
                label=label,
                builtin_id=item["id"],
                declared_name=item["name"],
                detail=item.get("detail", ""),
            )
        )
    return builtins


def _dedupe_roots(roots: tuple[HarnessDiscoveryRoot, ...]) -> tuple[HarnessDiscoveryRoot, ...]:
    selected: list[HarnessDiscoveryRoot] = []
    seen: set[Path] = set()
    for root in roots:
        resolved = root.path.resolve(strict=False)
        if resolved in seen:
            continue
        seen.add(resolved)
        selected.append(root)
    return tuple(selected)
