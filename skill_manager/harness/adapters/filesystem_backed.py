from __future__ import annotations

from pathlib import Path

from skill_manager.domain import HarnessScan, SkillObservation, SkillParseError, SourceDescriptor, find_skill_roots, parse_skill_package

from ..contracts import AdapterConfig, HarnessLocation, HarnessStatus


class FilesystemHarnessAdapter:
    def __init__(
        self,
        *,
        config: AdapterConfig,
        managed_skills_root: Path,
        global_skills_root: Path | None = None,
    ) -> None:
        self.config = config
        self.managed_skills_root = managed_skills_root
        self.global_skills_root = global_skills_root

    def status(self) -> HarnessStatus:
        locations: list[HarnessLocation] = [
            HarnessLocation(
                kind="managed-root",
                label="Managed skills root",
                path=self.managed_skills_root,
                present=self.managed_skills_root.exists(),
            )
        ]
        if self.global_skills_root is not None:
            locations.append(
                HarnessLocation(
                    kind="global-root",
                    label="Global skills root",
                    path=self.global_skills_root,
                    present=self.global_skills_root.exists(),
                )
            )

        return HarnessStatus(
            harness=self.config.harness,
            label=self.config.label,
            logo_key=self.config.logo_key,
            detected=any(location.present for location in locations),
            locations=tuple(locations),
        )

    def scan(self) -> HarnessScan:
        status = self.status()
        observations: list[SkillObservation] = []

        for scope, root in (("user", self.managed_skills_root), ("global", self.global_skills_root)):
            if root is None:
                continue
            for skill_root in find_skill_roots(root):
                try:
                    package = parse_skill_package(
                        skill_root,
                        default_source=SourceDescriptor(
                            kind="harness-local",
                            locator=f"{self.config.harness}:{scope}:{skill_root.name}",
                        ),
                    )
                except SkillParseError:
                    continue
                observations.append(
                    SkillObservation(
                        harness=self.config.harness,
                        label=self.config.label,
                        scope=scope,
                        package=package,
                    )
                )

        return HarnessScan(
            harness=self.config.harness,
            label=self.config.label,
            logo_key=self.config.logo_key,
            detected=status.detected or bool(observations),
            manageable=True,
            skills=tuple(observations),
        )

    def invalidate(self) -> None:
        return None
