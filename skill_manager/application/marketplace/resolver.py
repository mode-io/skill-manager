from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
from urllib.parse import quote

from skill_manager.sources import GitHubSource
from .repo_snapshots import GitHubRepoSnapshotService

from .models import RepoDisplayMetadata


@dataclass(frozen=True)
class DetailEnrichment:
    description: str
    folder_url: str | None
    folder_resolution_complete: bool = False

    def to_dict(self) -> dict[str, object]:
        return {
            "description": self.description,
            "folderUrl": self.folder_url,
            "folderResolutionComplete": self.folder_resolution_complete,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, object]) -> "DetailEnrichment":
        description = payload.get("description")
        folder_url = payload.get("folderUrl")
        folder_resolution_complete = payload.get("folderResolutionComplete")
        return cls(
            description=description if isinstance(description, str) else "",
            folder_url=folder_url if isinstance(folder_url, str) and folder_url else None,
            folder_resolution_complete=folder_resolution_complete if isinstance(folder_resolution_complete, bool) else False,
        )


class GitHubSkillResolver:
    def __init__(self, repo_snapshots: GitHubRepoSnapshotService | None = None) -> None:
        self.repo_snapshots = repo_snapshots or GitHubRepoSnapshotService()

    def repo_metadata(self, repo: str) -> RepoDisplayMetadata:
        return self.repo_snapshots.metadata_for_repo(repo)

    def repo_metadata_for_repos(self, repos: list[str]) -> dict[str, RepoDisplayMetadata]:
        return self.repo_snapshots.metadata_for_repos(repos)

    def close(self) -> None:
        self.repo_snapshots.close()

    def github_folder_url(self, repo: str, skill_id: str, *, default_branch: str | None = None) -> str | None:
        owner, repo_name = repo.split("/", 1)
        locator = f"{owner}/{repo_name}/{skill_id}"
        with TemporaryDirectory(prefix="skill-manager-marketplace-") as temp_dir:
            work_dir = Path(temp_dir)
            skill_path = GitHubSource().fetch(locator, work_dir)
            clone_dir = work_dir / f"{owner}--{repo_name}"
            branch = default_branch or self._checked_out_branch(clone_dir) or "HEAD"
            relative_path = skill_path.relative_to(clone_dir).as_posix()
        return f"https://github.com/{repo}/tree/{quote(branch, safe='')}/{quote(relative_path, safe='/')}"

    @staticmethod
    def _checked_out_branch(clone_dir: Path) -> str | None:
        result = subprocess.run(
            ["git", "-C", str(clone_dir), "branch", "--show-current"],
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
        branch = result.stdout.strip()
        return branch or None
