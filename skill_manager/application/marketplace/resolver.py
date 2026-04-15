from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.sources import GitHubSource, github_folder_url as build_github_folder_url
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
            resolved = GitHubSource().resolve(locator, work_dir)
        return build_github_folder_url(
            repo,
            ref=default_branch or resolved.ref,
            relative_path=resolved.relative_path,
        )
