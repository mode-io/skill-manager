from __future__ import annotations

from pathlib import Path

from skill_manager.domain import HarnessScan, SkillObservation, SkillParseError, SourceDescriptor, find_skill_roots, parse_skill_package

from ..contracts import AdapterConfig


class FilesystemHarnessAdapter:
    def __init__(
        self,
        *,
        config: AdapterConfig,
        env: dict[str, str],
        user_skills_root: Path,
        global_skills_root: Path | None = None,
    ) -> None:
        self.config = config
        self.env = env
        self.user_skills_root = user_skills_root
        self.global_skills_root = global_skills_root

    def scan(self) -> HarnessScan:
        observations: list[SkillObservation] = []
        issues: list[str] = []
        detection_details: list[str] = []
        detected = False

        for scope, root in (("user", self.user_skills_root), ("global", self.global_skills_root)):
            if root is None:
                continue
            if root.exists():
                detection_details.append(f"{scope}:{root}")
            for skill_root in find_skill_roots(root):
                try:
                    package = parse_skill_package(
                        skill_root,
                        default_source=SourceDescriptor(
                            kind="harness-local",
                            locator=f"{self.config.harness}:{scope}:{skill_root.name}",
                        ),
                    )
                except SkillParseError as error:
                    issues.append(str(error))
                    continue
                detected = True
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
            detected=detected,
            manageable=True,
            builtin_support=self.config.builtin_support,
            discovery_mode=self.config.discovery_mode,
            detection_details=tuple(detection_details),
            skills=tuple(observations),
            issues=tuple(issues),
        )
