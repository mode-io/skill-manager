from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from threading import Lock

from skill_manager.sources import (
    GitHubRepoMetadata,
    GitHubRepoMetadataClient,
    GitHubRepoMetadataError,
    github_owner_avatar_url,
    is_valid_github_repo,
)

from .cache import MarketplaceCache
from .models import RepoDisplayMetadata


@dataclass(frozen=True)
class GitHubRepoSnapshot:
    repo: str
    stars: int | None
    default_branch: str | None

    def to_dict(self) -> dict[str, object]:
        return {
            "status": "success",
            "repo": self.repo,
            "stars": self.stars,
            "defaultBranch": self.default_branch,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, object]) -> "GitHubRepoSnapshot | None":
        if payload.get("status") != "success":
            return None
        repo = payload.get("repo")
        stars = payload.get("stars")
        default_branch = payload.get("defaultBranch")
        if not isinstance(repo, str) or not repo:
            return None
        return cls(
            repo=repo,
            stars=stars if isinstance(stars, int) else None,
            default_branch=default_branch if isinstance(default_branch, str) and default_branch else None,
        )


@dataclass(frozen=True)
class GitHubRepoMetadataFailure:
    kind: str
    status_code: int | None

    def to_dict(self) -> dict[str, object]:
        return {
            "status": "failure",
            "kind": self.kind,
            "statusCode": self.status_code,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, object]) -> "GitHubRepoMetadataFailure | None":
        if payload.get("status") != "failure":
            return None
        kind = payload.get("kind")
        status_code = payload.get("statusCode")
        if not isinstance(kind, str) or not kind:
            return None
        return cls(kind=kind, status_code=status_code if isinstance(status_code, int) else None)


class GitHubRepoSnapshotService:
    _SUCCESS_FRESH_SECONDS = 24 * 60 * 60
    _SUCCESS_RETENTION_SECONDS = 30 * 24 * 60 * 60
    _TRANSIENT_FAILURE_SECONDS = 15 * 60
    _PERMANENT_FAILURE_SECONDS = 24 * 60 * 60
    _REFRESH_WORKERS = 4
    _SUCCESS_NAMESPACE = "repo-metadata-v2"
    _FAILURE_NAMESPACE = "repo-metadata-failures-v2"

    def __init__(
        self,
        *,
        cache: MarketplaceCache | None = None,
        metadata_client: GitHubRepoMetadataClient | None = None,
    ) -> None:
        self._cache = cache or MarketplaceCache()
        self._metadata_client = metadata_client or GitHubRepoMetadataClient()
        self._refresh_executor = ThreadPoolExecutor(max_workers=self._REFRESH_WORKERS, thread_name_prefix="skill-manager-github")
        self._refreshing: set[str] = set()
        self._refresh_lock = Lock()
        self._closed = False

    def metadata_for_repo(self, repo: str) -> RepoDisplayMetadata:
        if not is_valid_github_repo(repo):
            return RepoDisplayMetadata(stars=None, image_url=None, default_branch=None)

        avatar_url = github_owner_avatar_url(repo)
        success_record = self._cache.load(self._SUCCESS_NAMESPACE, repo)
        if success_record is not None and isinstance(success_record.payload, dict):
            snapshot = GitHubRepoSnapshot.from_dict(success_record.payload)
            if snapshot is not None:
                if success_record.age_seconds <= self._SUCCESS_FRESH_SECONDS:
                    return RepoDisplayMetadata(
                        stars=snapshot.stars,
                        image_url=avatar_url,
                        default_branch=snapshot.default_branch,
                    )
                if success_record.age_seconds <= self._SUCCESS_RETENTION_SECONDS:
                    self._schedule_refresh(repo)
                    return RepoDisplayMetadata(
                        stars=snapshot.stars,
                        image_url=avatar_url,
                        default_branch=snapshot.default_branch,
                    )

        failure_record = self._cache.load(self._FAILURE_NAMESPACE, repo)
        if failure_record is not None and isinstance(failure_record.payload, dict):
            failure = GitHubRepoMetadataFailure.from_dict(failure_record.payload)
            if failure is not None:
                failure_ttl = (
                    self._PERMANENT_FAILURE_SECONDS
                    if failure.kind == "permanent"
                    else self._TRANSIENT_FAILURE_SECONDS
                )
                if failure_record.age_seconds <= failure_ttl:
                    return RepoDisplayMetadata(stars=None, image_url=avatar_url, default_branch=None)

        self._schedule_refresh(repo)
        return RepoDisplayMetadata(stars=None, image_url=avatar_url, default_branch=None)

    def metadata_for_repos(self, repos: list[str]) -> dict[str, RepoDisplayMetadata]:
        return {repo: self.metadata_for_repo(repo) for repo in sorted(set(repos))}

    def refresh_repo_now(self, repo: str) -> None:
        if not is_valid_github_repo(repo):
            return
        self._refresh_repo(repo)

    def close(self, *, wait: bool = True) -> None:
        with self._refresh_lock:
            if self._closed:
                return
            self._closed = True
        self._refresh_executor.shutdown(wait=wait, cancel_futures=not wait)

    def _schedule_refresh(self, repo: str) -> None:
        with self._refresh_lock:
            if self._closed or repo in self._refreshing:
                return
            self._refreshing.add(repo)
        try:
            self._refresh_executor.submit(self._refresh_repo, repo)
        except RuntimeError:
            with self._refresh_lock:
                self._refreshing.discard(repo)

    def _refresh_repo(self, repo: str) -> None:
        try:
            metadata = self._metadata_client.metadata_for_repo(repo)
            if metadata is None:
                self._cache.write(
                    self._FAILURE_NAMESPACE,
                    repo,
                    GitHubRepoMetadataFailure(kind="permanent", status_code=404).to_dict(),
                )
                return
            self._cache.write(self._SUCCESS_NAMESPACE, repo, self._snapshot_from_metadata(metadata).to_dict())
        except GitHubRepoMetadataError as error:
            self._cache.write(
                self._FAILURE_NAMESPACE,
                repo,
                GitHubRepoMetadataFailure(kind="transient", status_code=error.status_code).to_dict(),
            )
        finally:
            with self._refresh_lock:
                self._refreshing.discard(repo)

    @staticmethod
    def _snapshot_from_metadata(metadata: GitHubRepoMetadata) -> GitHubRepoSnapshot:
        repo = metadata.repo or ""
        stars = metadata.stars if metadata.stars > 0 else None
        return GitHubRepoSnapshot(
            repo=repo,
            stars=stars,
            default_branch=metadata.default_branch,
        )

    def __del__(self) -> None:
        try:
            self.close(wait=False)
        except Exception:  # noqa: BLE001
            pass
