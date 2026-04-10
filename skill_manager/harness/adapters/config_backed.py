from __future__ import annotations

import json
from pathlib import Path

from dataclasses import replace

from skill_manager.domain import BuiltinObservation, HarnessScan

from ..contracts import AdapterConfig, HarnessStatus
from .filesystem_backed import FilesystemHarnessAdapter


class ConfigHarnessAdapter(FilesystemHarnessAdapter):
    def __init__(
        self,
        *,
        config: AdapterConfig,
        managed_skills_root: Path,
        builtins_path: Path | None = None,
        global_skills_root: Path | None = None,
    ) -> None:
        super().__init__(
            config=config,
            managed_skills_root=managed_skills_root,
            global_skills_root=global_skills_root,
        )
        self.builtins_path = builtins_path

    def status(self) -> HarnessStatus:
        base = super().status()
        builtins_present = self.builtins_path is not None and self.builtins_path.exists()
        return replace(base, detected=base.detected or builtins_present)

    def scan(self) -> HarnessScan:
        status = self.status()
        base = super().scan()
        builtins = tuple(self._load_builtins())
        return replace(
            base,
            detected=status.detected or bool(builtins),
            builtins=builtins,
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
