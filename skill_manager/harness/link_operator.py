from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal


class MutationError(Exception):
    """Raised when a mutation is refused (e.g. target is a real directory)."""

    def __init__(self, message: str, status: int = 409) -> None:
        self.status = status
        super().__init__(message)


@dataclass(frozen=True)
class LinkResult:
    action: Literal["created", "removed", "already_linked", "already_absent"]
    detail: str


class LinkOperator:
    """Manages symlinks between the shared store and harness skill directories."""

    def link_shared(self, *, package_path: Path, harness_skills_root: Path) -> LinkResult:
        resolved_target = package_path.resolve()
        link = harness_skills_root / package_path.name
        if link.is_symlink():
            if link.resolve() == resolved_target:
                return LinkResult(action="already_linked", detail=str(link))
            raise MutationError(f"symlink already exists but points to {link.resolve()}, not {resolved_target}")
        if link.exists():
            raise MutationError(f"real directory exists at {link}; will not overwrite")
        harness_skills_root.mkdir(parents=True, exist_ok=True)
        link.symlink_to(resolved_target)
        return LinkResult(action="created", detail=str(link))

    def unlink_shared(self, *, package_dir: str, harness_skills_root: Path) -> LinkResult:
        link = harness_skills_root / package_dir
        if not link.exists() and not link.is_symlink():
            return LinkResult(action="already_absent", detail=str(link))
        if not link.is_symlink():
            raise MutationError(f"not a symlink at {link}; will not delete real directory")
        link.unlink()
        return LinkResult(action="removed", detail=str(link))
