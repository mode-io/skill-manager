from __future__ import annotations

import unittest

from skill_manager.sources import GitHubAvatarAsset, GitHubOwnerMetadata, GitHubRepoMetadata, GitHubRepoMetadataClient


class GitHubRepoMetadataClientTests(unittest.TestCase):
    def test_metadata_and_avatar_fetches_are_cached_per_repo(self) -> None:
        metadata_calls: list[str] = []
        avatar_calls: list[str] = []

        def metadata_fetcher(repo: str) -> GitHubRepoMetadata | None:
            metadata_calls.append(repo)
            return GitHubRepoMetadata(
                repo=repo,
                repo_url=f"https://github.com/{repo}",
                owner_login="mode-io",
                owner_avatar_url="https://avatars.githubusercontent.com/u/424242?v=4",
                stars=512,
            )

        def avatar_fetcher(avatar_url: str) -> GitHubAvatarAsset | None:
            avatar_calls.append(avatar_url)
            return GitHubAvatarAsset(content_type="image/svg+xml", body=b"<svg />")

        client = GitHubRepoMetadataClient(
            metadata_fetcher=metadata_fetcher,
            avatar_fetcher=avatar_fetcher,
        )

        first_metadata = client.metadata_for_repo("mode-io/skills")
        second_metadata = client.metadata_for_repo("mode-io/skills")
        first_avatar = client.avatar_for_repo("mode-io/skills")
        second_avatar = client.avatar_for_repo("mode-io/skills")

        self.assertEqual(first_metadata, second_metadata)
        self.assertEqual(first_avatar, second_avatar)
        self.assertEqual(metadata_calls, ["mode-io/skills"])
        self.assertEqual(avatar_calls, ["https://avatars.githubusercontent.com/u/424242?v=4"])

    def test_invalid_repo_is_rejected_without_fetching(self) -> None:
        calls: list[str] = []

        def metadata_fetcher(repo: str) -> GitHubRepoMetadata | None:
            calls.append(repo)
            return None

        client = GitHubRepoMetadataClient(metadata_fetcher=metadata_fetcher)

        self.assertIsNone(client.metadata_for_repo("not-a-valid-repo"))
        self.assertIsNone(client.avatar_for_repo("still-not-valid"))
        self.assertEqual(calls, [])

    def test_owner_metadata_and_avatar_fetches_are_cached_per_login(self) -> None:
        owner_calls: list[str] = []
        avatar_calls: list[str] = []

        def owner_fetcher(login: str) -> GitHubOwnerMetadata | None:
            owner_calls.append(login)
            return GitHubOwnerMetadata(
                login=login,
                profile_url=f"https://github.com/{login}",
                avatar_url="https://avatars.githubusercontent.com/u/777777?v=4",
            )

        def avatar_fetcher(avatar_url: str) -> GitHubAvatarAsset | None:
            avatar_calls.append(avatar_url)
            return GitHubAvatarAsset(content_type="image/svg+xml", body=b"<svg />")

        client = GitHubRepoMetadataClient(
            owner_fetcher=owner_fetcher,
            avatar_fetcher=avatar_fetcher,
        )

        first_owner = client.owner_metadata_for_login("openclaw")
        second_owner = client.owner_metadata_for_login("openclaw")
        first_avatar = client.avatar_for_owner("openclaw")
        second_avatar = client.avatar_for_owner("openclaw")

        self.assertEqual(first_owner, second_owner)
        self.assertEqual(first_avatar, second_avatar)
        self.assertEqual(owner_calls, ["openclaw"])
        self.assertEqual(avatar_calls, ["https://avatars.githubusercontent.com/u/777777?v=4"])

    def test_failed_avatar_fetch_does_not_poison_cache(self) -> None:
        avatar_calls: list[str] = []
        should_fail = True

        def metadata_fetcher(repo: str) -> GitHubRepoMetadata | None:
            return GitHubRepoMetadata(
                repo=repo,
                repo_url=f"https://github.com/{repo}",
                owner_login="mode-io",
                owner_avatar_url="https://avatars.githubusercontent.com/u/424242?v=4",
                stars=512,
            )

        def avatar_fetcher(avatar_url: str) -> GitHubAvatarAsset | None:
            nonlocal should_fail
            avatar_calls.append(avatar_url)
            if should_fail:
                should_fail = False
                return None
            return GitHubAvatarAsset(content_type="image/svg+xml", body=b"<svg />")

        client = GitHubRepoMetadataClient(
            metadata_fetcher=metadata_fetcher,
            avatar_fetcher=avatar_fetcher,
        )

        self.assertIsNone(client.avatar_for_repo("mode-io/skills"))
        self.assertIsNotNone(client.avatar_for_repo("mode-io/skills"))
        self.assertEqual(
            avatar_calls,
            [
                "https://avatars.githubusercontent.com/u/424242?v=4",
                "https://avatars.githubusercontent.com/u/424242?v=4",
            ],
        )


if __name__ == "__main__":
    unittest.main()
