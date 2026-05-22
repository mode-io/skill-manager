from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from skill_manager.application.skills.queries import SkillsQueryService


class ScanTargetResolver:
    def __init__(self, skills_queries: SkillsQueryService) -> None:
        self.skills_queries = skills_queries

    def resolve_skill_path(self, skill_ref: str) -> Path | None:
        return self.skills_queries.get_skill_path(skill_ref)
