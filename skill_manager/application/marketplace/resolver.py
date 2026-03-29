from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import quote

from skill_manager.sources import GitHubRepoMetadataClient, GitHubSource

from .models import RepoDisplayMetadata


@dataclass(frozen=True)
class DetailEnrichment:
    description: str
    github_folder_url: str | None

    def to_dict(self) -> dict[str, object]:
        return {
            "description": self.description,
            "githubFolderUrl": self.github_folder_url,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, object]) -> "DetailEnrichment":
        description = payload.get("description")
        github_folder_url = payload.get("githubFolderUrl")
        return cls(
            description=description if isinstance(description, str) else "",
            github_folder_url=github_folder_url if isinstance(github_folder_url, str) and github_folder_url else None,
        )


class GitHubSkillResolver:
    def __init__(self, github_client: GitHubRepoMetadataClient | None = None) -> None:
        self.github_client = github_client or GitHubRepoMetadataClient()

    def repo_metadata(self, repo: str) -> RepoDisplayMetadata:
        snapshot = self.github_client.identity_snapshot(repo=repo)
        default_branch = None
        if snapshot.repo_metadata is not None:
            default_branch = snapshot.repo_metadata.default_branch
        stars = snapshot.stars if snapshot.stars > 0 else None
        return RepoDisplayMetadata(
            stars=stars,
            image_url=snapshot.avatar_url,
            default_branch=default_branch,
        )

    def github_folder_url(self, repo: str, skill_id: str, *, default_branch: str | None = None) -> str | None:
        owner, repo_name = repo.split("/", 1)
        locator = f"{owner}/{repo_name}/{skill_id}"
        branch = default_branch or "HEAD"
        with TemporaryDirectory(prefix="skill-manager-marketplace-") as temp_dir:
            work_dir = Path(temp_dir)
            skill_path = GitHubSource().fetch(locator, work_dir)
            clone_dir = work_dir / f"{owner}--{repo_name}"
            relative_path = skill_path.relative_to(clone_dir).as_posix()
        return f"https://github.com/{repo}/tree/{quote(branch, safe='')}/{quote(relative_path, safe='/')}"
