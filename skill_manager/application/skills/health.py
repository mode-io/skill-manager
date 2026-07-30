from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class CheckIssue:
    severity: Literal["warning", "error"]
    message: str
    code: str = ""
