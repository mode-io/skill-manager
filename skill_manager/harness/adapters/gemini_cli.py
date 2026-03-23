from __future__ import annotations

import json
from pathlib import Path

from dataclasses import replace

from skill_manager.domain import BuiltinObservation, HarnessScan, SkillObservation, SkillParseError, SourceDescriptor, parse_skill_package

from ..command_runner import CommandRunner
from ..contracts import AdapterConfig
from .config_backed import ConfigHarnessAdapter


class GeminiCliHarnessAdapter(ConfigHarnessAdapter):
    def __init__(
        self,
        *,
        command_runner: CommandRunner,
        user_skills_root: Path,
        builtins_path: Path | None = None,
    ) -> None:
        super().__init__(
            config=AdapterConfig(harness="gemini", label="Gemini", discovery_mode="command", builtin_support=True),
            user_skills_root=user_skills_root,
            builtins_path=builtins_path,
        )
        self.command_runner = command_runner

    def scan(self) -> HarnessScan:
        result = self.command_runner.run(("gemini", "skills", "list", "--json"))
        if result.returncode != 0 or not result.stdout.strip():
            fallback = super().scan()
            issues = list(fallback.issues)
            if result.stderr.strip():
                issues.append(result.stderr.strip())
            return replace(fallback, issues=tuple(issues))

        payload = json.loads(result.stdout)
        observations: list[SkillObservation] = []
        builtins: list[BuiltinObservation] = []
        issues: list[str] = []
        for item in payload.get("skills", []):
            path = Path(item["path"])
            try:
                package = parse_skill_package(
                    path,
                    default_source=SourceDescriptor(kind="harness-local", locator=f"gemini:{item.get('scope', 'user')}:{path.name}"),
                )
            except SkillParseError as error:
                issues.append(str(error))
                continue
            observations.append(
                SkillObservation(
                    harness="gemini",
                    label="Gemini",
                    scope=item.get("scope", "user"),
                    package=package,
                )
            )
        for item in payload.get("builtins", []):
            builtins.append(
                BuiltinObservation(
                    harness="gemini",
                    label="Gemini",
                    builtin_id=item["id"],
                    declared_name=item["name"],
                    detail=item.get("detail", ""),
                )
            )
        return HarnessScan(
            harness="gemini",
            label="Gemini",
            detected=bool(observations or builtins),
            manageable=True,
            builtin_support=True,
            discovery_mode="command",
            detection_details=("command:gemini skills list --json",),
            skills=tuple(observations),
            builtins=tuple(builtins),
            issues=tuple(issues),
        )
