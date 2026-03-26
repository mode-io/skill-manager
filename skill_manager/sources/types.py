from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SkillListing:
    name: str
    description: str
    source_kind: str
    source_locator: str
    registry: str
    installs: int = 0
    github_repo: str | None = None
    github_owner: str | None = None
    github_stars: int = 0
