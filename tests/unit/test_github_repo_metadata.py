from __future__ import annotations

import json
from pathlib import Path
from tempfile import TemporaryDirectory
import time
import unittest

from skill_manager.application.marketplace.cache import MarketplaceCache
from skill_manager.application.marketplace.repo_snapshots import GitHubRepoSnapshotService
from skill_manager.sources import (
    GitHubRepoMetadata,
    GitHubRepoMetadataClient,
    GitHubRepoMetadataError,
    github_owner_avatar_url,
)


class GitHubRepoMetadataClientTests(unittest.TestCase):
    def test_metadata_fetches_are_cached_per_repo(self) -> None:
        calls: list[str] = []

        def metadata_fetcher(repo: str) -> GitHubRepoMetadata | None:
            calls.append(repo)
            return GitHubRepoMetadata(
                repo=repo,
                stars=512,
                default_branch="main",
            )

        client = GitHubRepoMetadataClient(metadata_fetcher=metadata_fetcher)

        first = client.metadata_for_repo("mode-io/skills")
        second = client.metadata_for_repo("mode-io/skills")

        self.assertEqual(first, second)
        self.assertEqual(calls, ["mode-io/skills"])

    def test_invalid_repo_is_rejected_without_fetching(self) -> None:
        calls: list[str] = []

        def metadata_fetcher(repo: str) -> GitHubRepoMetadata | None:
            calls.append(repo)
            return None

        client = GitHubRepoMetadataClient(metadata_fetcher=metadata_fetcher)

        self.assertIsNone(client.metadata_for_repo("smithery.ai"))
        self.assertEqual(calls, [])

    def test_transient_errors_are_propagated(self) -> None:
        client = GitHubRepoMetadataClient(
            metadata_fetcher=lambda repo: (_ for _ in ()).throw(
                GitHubRepoMetadataError(repo, "rate limit", status_code=403)
            ),
        )

        with self.assertRaises(GitHubRepoMetadataError) as captured:
            client.metadata_for_repo("mode-io/skills")

        self.assertEqual(captured.exception.status_code, 403)


class GitHubRepoSnapshotServiceTests(unittest.TestCase):
    def test_metadata_for_repo_uses_deterministic_avatar_url(self) -> None:
        with TemporaryDirectory() as temp_dir:
            service = GitHubRepoSnapshotService(
                cache=MarketplaceCache(Path(temp_dir)),
                metadata_client=GitHubRepoMetadataClient(metadata_fetcher=lambda repo: None),
            )
            try:
                metadata = service.metadata_for_repo("mode-io/skills")
            finally:
                service.close()

        self.assertEqual(metadata.image_url, github_owner_avatar_url("mode-io/skills"))
        self.assertIsNone(metadata.stars)

    def test_transient_failure_is_negative_cached(self) -> None:
        calls: list[str] = []
        with TemporaryDirectory() as temp_dir:
            cache = MarketplaceCache(Path(temp_dir))
            service = GitHubRepoSnapshotService(
                cache=cache,
                metadata_client=GitHubRepoMetadataClient(
                    metadata_fetcher=lambda repo: _raise_transient(calls, repo),
                ),
            )
            try:
                service.refresh_repo_now("mode-io/skills")
                first = service.metadata_for_repo("mode-io/skills")
                second = service.metadata_for_repo("mode-io/skills")
            finally:
                service.close()

        self.assertEqual(calls, ["mode-io/skills"])
        self.assertEqual(first.image_url, github_owner_avatar_url("mode-io/skills"))
        self.assertIsNone(first.stars)
        self.assertEqual(second.image_url, github_owner_avatar_url("mode-io/skills"))
        self.assertIsNone(second.stars)

    def test_permanent_failure_is_negative_cached(self) -> None:
        calls: list[str] = []
        with TemporaryDirectory() as temp_dir:
            cache = MarketplaceCache(Path(temp_dir))
            service = GitHubRepoSnapshotService(
                cache=cache,
                metadata_client=GitHubRepoMetadataClient(
                    metadata_fetcher=lambda repo: _record_none(calls, repo),
                ),
            )
            try:
                service.refresh_repo_now("mode-io/skills")
                metadata = service.metadata_for_repo("mode-io/skills")
            finally:
                service.close()

        self.assertEqual(calls, ["mode-io/skills"])
        self.assertEqual(metadata.image_url, github_owner_avatar_url("mode-io/skills"))
        self.assertIsNone(metadata.stars)

    def test_stale_success_survives_transient_refresh_failure(self) -> None:
        with TemporaryDirectory() as temp_dir:
            cache = MarketplaceCache(Path(temp_dir))
            seed = GitHubRepoSnapshotService(
                cache=cache,
                metadata_client=GitHubRepoMetadataClient(
                    metadata_fetcher=lambda repo: GitHubRepoMetadata(
                        repo=repo,
                        stars=512,
                        default_branch="main",
                    ),
                ),
            )
            service = GitHubRepoSnapshotService(
                cache=cache,
                metadata_client=GitHubRepoMetadataClient(
                    metadata_fetcher=lambda repo: (_ for _ in ()).throw(
                        GitHubRepoMetadataError(repo, "rate limit", status_code=403)
                    ),
                ),
            )
            try:
                seed.refresh_repo_now("mode-io/skills")
                _age_cache_entry(cache, "repo-metadata-v2", "mode-io/skills", seconds_ago=2 * 24 * 60 * 60)
                service.refresh_repo_now("mode-io/skills")
                metadata = service.metadata_for_repo("mode-io/skills")
            finally:
                seed.close()
                service.close()

        self.assertEqual(metadata.image_url, github_owner_avatar_url("mode-io/skills"))
        self.assertEqual(metadata.stars, 512)
        self.assertEqual(metadata.default_branch, "main")

    def test_success_cache_is_persistent_across_service_instances(self) -> None:
        with TemporaryDirectory() as temp_dir:
            cache = MarketplaceCache(Path(temp_dir))
            first = GitHubRepoSnapshotService(
                cache=cache,
                metadata_client=GitHubRepoMetadataClient(
                    metadata_fetcher=lambda repo: GitHubRepoMetadata(
                        repo=repo,
                        stars=271,
                        default_branch="main",
                    ),
                ),
            )
            second = GitHubRepoSnapshotService(
                cache=cache,
                metadata_client=GitHubRepoMetadataClient(
                    metadata_fetcher=lambda repo: (_ for _ in ()).throw(
                        GitHubRepoMetadataError(repo, "rate limit", status_code=403)
                    ),
                ),
            )
            try:
                first.refresh_repo_now("vercel-labs/skills")
                metadata = second.metadata_for_repo("vercel-labs/skills")
            finally:
                first.close()
                second.close()

        self.assertEqual(metadata.image_url, github_owner_avatar_url("vercel-labs/skills"))
        self.assertEqual(metadata.stars, 271)

    def test_success_snapshot_cache_persists_only_runtime_fields(self) -> None:
        with TemporaryDirectory() as temp_dir:
            cache = MarketplaceCache(Path(temp_dir))
            service = GitHubRepoSnapshotService(
                cache=cache,
                metadata_client=GitHubRepoMetadataClient(
                    metadata_fetcher=lambda repo: GitHubRepoMetadata(
                        repo=repo,
                        stars=271,
                        default_branch="main",
                    ),
                ),
            )
            try:
                service.refresh_repo_now("vercel-labs/skills")
            finally:
                service.close()

            stored = cache.load("repo-metadata-v2", "vercel-labs/skills")

        assert stored is not None
        assert isinstance(stored.payload, dict)
        self.assertEqual(
            stored.payload,
            {
                "status": "success",
                "repo": "vercel-labs/skills",
                "stars": 271,
                "defaultBranch": "main",
            },
        )


def _raise_transient(calls: list[str], repo: str) -> GitHubRepoMetadata | None:
    calls.append(repo)
    raise GitHubRepoMetadataError(repo, "rate limit", status_code=403)


def _record_none(calls: list[str], repo: str) -> GitHubRepoMetadata | None:
    calls.append(repo)
    return None


def _age_cache_entry(cache: MarketplaceCache, namespace: str, key: str, *, seconds_ago: int) -> None:
    path = cache._path_for(namespace, key)
    if path is None or not path.is_file():
        raise AssertionError(f"missing cache entry for {namespace}:{key}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["fetchedAt"] = time.time() - seconds_ago
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
