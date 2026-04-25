from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path

from skill_manager.atomic_files import atomic_write_text, file_lock


@dataclass(frozen=True)
class HarnessSupportPreferences:
    disabled_harnesses: tuple[str, ...] = ()

    def is_enabled(self, harness: str) -> bool:
        return harness not in self.disabled_harnesses

class HarnessSupportStore:
    def __init__(self, path: Path) -> None:
        self.path = path

    def load(self) -> HarnessSupportPreferences:
        if not self.path.is_file():
            return HarnessSupportPreferences()
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        disabled = payload.get("disabledHarnesses", [])
        if not isinstance(disabled, list):
            return HarnessSupportPreferences()
        values = tuple(sorted({item for item in disabled if isinstance(item, str) and item}))
        return HarnessSupportPreferences(disabled_harnesses=values)

    def set_enabled(self, harness: str, enabled: bool) -> HarnessSupportPreferences:
        with file_lock(self.path.with_suffix(".lock")):
            current = set(self.load().disabled_harnesses)
            if enabled:
                current.discard(harness)
            else:
                current.add(harness)
            next_preferences = HarnessSupportPreferences(disabled_harnesses=tuple(sorted(current)))
            self._write(next_preferences)
            return next_preferences

    def enabled_harnesses(self, supported_harnesses: tuple[str, ...]) -> tuple[str, ...]:
        preferences = self.load()
        return tuple(harness for harness in supported_harnesses if preferences.is_enabled(harness))

    def _write(self, preferences: HarnessSupportPreferences) -> None:
        atomic_write_text(
            self.path,
            json.dumps({"disabledHarnesses": list(preferences.disabled_harnesses)}, indent=2, sort_keys=True) + "\n",
        )
