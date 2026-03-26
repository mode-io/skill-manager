from __future__ import annotations

from skill_manager.application.marketplace import MarketplaceService
from skill_manager.sources import GitHubAvatarAsset, GitHubOwnerMetadata, GitHubRepoMetadata, GitHubRepoMetadataClient
from skill_manager.sources.types import SkillListing

_FIXTURE_AVATAR = b"""<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="6" fill="#D8DDD7"/><text x="14" y="17" text-anchor="middle" font-size="10" font-family="monospace" fill="#1F2A24">MO</text></svg>"""


def fixture_marketplace_search(query: str, *, limit: int = 20) -> list[SkillListing]:
    items = [
        SkillListing(
            name="Mode Switch",
            description="Switch between supported skill execution modes.",
            source_kind="github",
            source_locator="github:mode-io/skills/mode-switch",
            registry="skillssh",
            installs=128,
            github_repo="mode-io/skills",
        ),
        SkillListing(
            name="Switch Modes",
            description="Community-maintained runtime mode switching.",
            source_kind="agentskill",
            source_locator="agentskill:openclaw/switch-modes",
            registry="agentskill",
            installs=18,
            github_owner="openclaw",
            github_stars=2218,
        ),
    ]
    needle = query.strip().lower()
    if not needle:
        return items[:limit]
    filtered = [item for item in items if needle in item.name.lower() or needle in item.description.lower()]
    return filtered[:limit]


def create_fixture_marketplace_service() -> MarketplaceService:
    github_client = GitHubRepoMetadataClient(
        metadata_fetcher=_fixture_repo_metadata,
        owner_fetcher=_fixture_owner_metadata,
        avatar_fetcher=_fixture_avatar_asset,
    )
    return MarketplaceService(
        searchers=(fixture_marketplace_search,),
        github_client=github_client,
    )


def _fixture_repo_metadata(repo: str) -> GitHubRepoMetadata | None:
    if repo == "mode-io/skills":
        return GitHubRepoMetadata(
            repo=repo,
            repo_url="https://github.com/mode-io/skills",
            owner_login="mode-io",
            owner_avatar_url="https://avatars.githubusercontent.com/u/424242?v=4",
            stars=512,
        )
    return None


def _fixture_owner_metadata(login: str) -> GitHubOwnerMetadata | None:
    if login == "openclaw":
        return GitHubOwnerMetadata(
            login=login,
            profile_url="https://github.com/openclaw",
            avatar_url="https://avatars.githubusercontent.com/u/777777?v=4",
        )
    return None


def _fixture_avatar_asset(avatar_url: str) -> GitHubAvatarAsset | None:
    if "avatars.githubusercontent.com" not in avatar_url:
        return None
    return GitHubAvatarAsset(content_type="image/svg+xml", body=_FIXTURE_AVATAR)
