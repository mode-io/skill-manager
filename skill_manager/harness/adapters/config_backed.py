from __future__ import annotations

import json
from pathlib import Path

from skill_manager.domain import BuiltinObservation, HarnessScan

from ..contracts import AdapterConfig
from .filesystem_backed import FilesystemHarnessAdapter


class ConfigHarnessAdapter(FilesystemHarnessAdapter):
    def __init__(
        self,
        *,
        config: AdapterConfig,
        env: dict[str, str],
        user_skills_root: Path,
        builtins_path: Path | None = None,
        global_skills_root: Path | None = None,
    ) -> None:
        super().__init__(
            config=config,
            env=env,
            user_skills_root=user_skills_root,
            global_skills_root=global_skills_root,
        )
        self.builtins_path = builtins_path

    def scan(self) -> HarnessScan:
        base = super().scan()
        builtins = tuple(self._load_builtins())
        detection_details = list(base.detection_details)
        if self.builtins_path is not None and self.builtins_path.exists():
            detection_details.append(f"builtins:{self.builtins_path}")
        return HarnessScan(
            harness=base.harness,
            label=base.label,
            detected=base.detected or bool(builtins),
            manageable=base.manageable,
            builtin_support=base.builtin_support,
            discovery_mode=base.discovery_mode,
            detection_details=tuple(detection_details),
            skills=base.skills,
            builtins=builtins,
            issues=base.issues,
        )

    def _load_builtins(self) -> list[BuiltinObservation]:
        if self.builtins_path is None or not self.builtins_path.is_file():
            return []
        payload = json.loads(self.builtins_path.read_text(encoding="utf-8"))
        builtins: list[BuiltinObservation] = []
        for item in payload.get("builtins", payload.get("skills", [])):
            builtins.append(
                BuiltinObservation(
                    harness=self.config.harness,
                    label=self.config.label,
                    builtin_id=item["id"],
                    declared_name=item["name"],
                    detail=item.get("detail", ""),
                )
            )
        return builtins
