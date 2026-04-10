from __future__ import annotations

import json
from pathlib import Path

from skill_manager.domain import (
    BuiltinObservation,
    HarnessScan,
    SkillObservation,
    SkillParseError,
    SourceDescriptor,
    find_skill_roots,
    parse_skill_package,
)

from .contracts import HarnessDefinitionLike, HarnessDriver, HarnessLocation, HarnessManager, HarnessStatus
from .managers import SymlinkHarnessManager
from .resolution import CatalogResolution, CatalogResolver, DirectoryResolution, DirectoryResolver


class FilesystemHarnessDriver(HarnessDriver):
    def __init__(
        self,
        *,
        definition: HarnessDefinitionLike,
        resolver: DirectoryResolver,
    ) -> None:
        self.harness = definition.harness
        self.label = definition.label
        self.logo_key = definition.logo_key
        self._resolver = resolver

    def manager(self) -> HarnessManager | None:
        return SymlinkHarnessManager(self._resolver.resolve().managed_root)

    def status(self) -> HarnessStatus:
        resolved = self._resolver.resolve()
        locations: list[HarnessLocation] = [
            HarnessLocation(
                kind="managed-root",
                label="Managed skills root",
                path=resolved.managed_root,
                present=resolved.managed_root.exists(),
            )
        ]
        if resolved.global_root is not None:
            locations.append(
                HarnessLocation(
                    kind="global-root",
                    label="Global skills root",
                    path=resolved.global_root,
                    present=resolved.global_root.exists(),
                )
            )
        return HarnessStatus(
            harness=self.harness,
            label=self.label,
            logo_key=self.logo_key,
            detected=any(location.present for location in locations),
            locations=tuple(locations),
        )

    def scan(self) -> HarnessScan:
        resolved = self._resolver.resolve()
        observations = _scan_skill_roots(
            harness=self.harness,
            label=self.label,
            roots=(("user", resolved.managed_root), ("global", resolved.global_root)),
        )
        status = self.status()
        return HarnessScan(
            harness=self.harness,
            label=self.label,
            logo_key=self.logo_key,
            detected=status.detected or bool(observations),
            manageable=self.manager() is not None,
            skills=tuple(observations),
        )

    def invalidate(self) -> None:
        return None


class CatalogHarnessDriver(FilesystemHarnessDriver):
    def __init__(
        self,
        *,
        definition: HarnessDefinitionLike,
        resolver: CatalogResolver,
    ) -> None:
        self._catalog_resolver = resolver
        super().__init__(definition=definition, resolver=resolver)

    def status(self) -> HarnessStatus:
        resolved = self._catalog_resolver.resolve()
        locations = list(super().status().locations)
        if resolved.builtins_path is not None:
            locations.append(
                HarnessLocation(
                    kind="builtins",
                    label="Builtins catalog",
                    path=resolved.builtins_path,
                    present=resolved.builtins_path.exists(),
                )
            )
        detected = any(location.present for location in locations)
        return HarnessStatus(
            harness=self.harness,
            label=self.label,
            logo_key=self.logo_key,
            detected=detected,
            locations=tuple(locations),
        )

    def scan(self) -> HarnessScan:
        resolved = self._catalog_resolver.resolve()
        base = super().scan()
        builtins = tuple(_load_builtins(self.harness, self.label, resolved))
        return HarnessScan(
            harness=base.harness,
            label=base.label,
            logo_key=base.logo_key,
            detected=base.detected or bool(builtins),
            manageable=base.manageable,
            skills=base.skills,
            builtins=builtins,
        )


def _scan_skill_roots(
    *,
    harness: str,
    label: str,
    roots: tuple[tuple[str, Path | None], ...],
) -> list[SkillObservation]:
    observations: list[SkillObservation] = []
    for scope, root in roots:
        if root is None:
            continue
        for skill_root in find_skill_roots(root):
            try:
                package = parse_skill_package(
                    skill_root,
                    default_source=SourceDescriptor(
                        kind="harness-local",
                        locator=f"{harness}:{scope}:{skill_root.name}",
                    ),
                )
            except SkillParseError:
                continue
            observations.append(
                SkillObservation(
                    harness=harness,
                    label=label,
                    scope=scope,
                    package=package,
                )
            )
    return observations


def _load_builtins(harness: str, label: str, resolved: CatalogResolution) -> list[BuiltinObservation]:
    if resolved.builtins_path is None or not resolved.builtins_path.is_file():
        return []
    payload = json.loads(resolved.builtins_path.read_text(encoding="utf-8"))
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
