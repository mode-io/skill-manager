from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


@dataclass(frozen=True)
class CheckIssue:
    severity: Literal["warning", "error"]
    message: str
    code: str = ""


@dataclass(frozen=True)
class CheckReport:
    status: Literal["ok", "warning", "error"]
    issues: tuple[CheckIssue, ...] = ()
    warnings: tuple[CheckIssue, ...] = ()
    counts: dict[str, int] = field(default_factory=dict)
