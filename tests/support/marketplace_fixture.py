from __future__ import annotations

from skill_manager.application.marketplace_descriptions import AgentSkillManifestFetcher, MarketplaceDescriptionResolver
from skill_manager.application.marketplace import MarketplaceService
from skill_manager.sources import GitHubAvatarAsset, GitHubManifestFetcher, GitHubOwnerMetadata, GitHubRepoMetadata, GitHubRepoMetadataClient
from skill_manager.sources.types import SkillListing

_FIXTURE_AVATAR = b"""<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="6" fill="#D8DDD7"/><text x="14" y="17" text-anchor="middle" font-size="10" font-family="monospace" fill="#1F2A24">MO</text></svg>"""


def fixture_marketplace_search(query: str, *, limit: int = 20) -> list[SkillListing]:
    items = _fixture_listings()
    needle = query.strip().lower()
    if not needle:
        return items[:limit]
    filtered = [item for item in items if needle in item.name.lower() or needle in item.description_hint.lower()]
    return filtered[:limit]


def create_fixture_marketplace_service() -> MarketplaceService:
    github_client = GitHubRepoMetadataClient(
        metadata_fetcher=_fixture_repo_metadata,
        owner_fetcher=_fixture_owner_metadata,
        avatar_fetcher=_fixture_avatar_asset,
    )
    description_resolver = MarketplaceDescriptionResolver(
        github_fetcher=GitHubManifestFetcher(file_text_fetcher=_fixture_github_manifest_text, tree_fetcher=_fixture_github_tree_paths),
        agentskill_fetcher=_FixtureAgentSkillManifestFetcher(),
    )
    return MarketplaceService(
        searchers=(fixture_marketplace_search,),
        browse_searchers=(fixture_marketplace_search,),
        github_client=github_client,
        description_resolver=description_resolver,
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


def _fixture_github_tree_paths(repo: str) -> list[str]:
    if repo == "mode-io/skills":
        return [
            "mode-switch/SKILL.md",
            *[f"debug-lane-{index}/SKILL.md" for index in range(1, 23)],
        ]
    return []


def _fixture_github_manifest_text(repo: str, path: str) -> str | None:
    if repo != "mode-io/skills":
        return None
    skill_name = path.split("/", 1)[0].replace("-", " ").title()
    return f"---\nname: {skill_name}\ndescription: Canonical description for {skill_name}.\n---\n\n# {skill_name}\n"


class _FixtureAgentSkillManifestFetcher(AgentSkillManifestFetcher):
    def fetch_manifest_text(self, source_locator: str) -> str | None:
        slug = source_locator.removeprefix("agentskill:")
        title = slug.split("/", 1)[-1].replace("-", " ").title()
        return f"---\nname: {title}\ndescription: Canonical description for {title}.\n---\n\n# {title}\n"


def _fixture_listings() -> list[SkillListing]:
    items: list[SkillListing] = [
        SkillListing(
            name="Mode Switch",
            description_hint="Switch between supported skill execution modes.",
            source_kind="github",
            source_locator="github:mode-io/skills/mode-switch",
            registry="skillssh",
            installs=128,
            github_repo="mode-io/skills",
        ),
        SkillListing(
            name="Switch Modes",
            description_hint="Community-maintained runtime mode switching.",
            source_kind="agentskill",
            source_locator="agentskill:openclaw/switch-modes",
            registry="agentskill",
            installs=18,
            github_owner="openclaw",
            github_stars=2218,
        ),
    ]

    for index in range(1, 23):
        items.append(
            SkillListing(
                name=f"Debug Lane {index}",
                description_hint=f"Debugging workflow sample {index} with varying description length for masonry layout checks.",
                source_kind="github" if index % 2 else "agentskill",
                source_locator=f"{'github:mode-io/skills/debug-lane' if index % 2 else 'agentskill:openclaw/debug-lane'}-{index}",
                registry="skillssh" if index % 2 else "agentskill",
                installs=120 - index,
                github_repo="mode-io/skills" if index % 2 else None,
                github_owner=None if index % 2 else "openclaw",
                github_stars=max(200 - index, 0),
            )
        )
    return items
