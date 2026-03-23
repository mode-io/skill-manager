from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from skill_manager.domain import HarnessScan


@dataclass(frozen=True)
class AdapterConfig:
    harness: str
    label: str
    discovery_mode: str
    builtin_support: bool


class HarnessAdapter(Protocol):
    config: AdapterConfig

    def scan(self) -> HarnessScan:
        ...
