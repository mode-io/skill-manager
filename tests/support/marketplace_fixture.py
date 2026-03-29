from __future__ import annotations

from pathlib import Path
from tempfile import mkdtemp

from skill_manager.application.marketplace import MarketplaceService
from skill_manager.application.marketplace.cache import MarketplaceCache
from skill_manager.application.marketplace.models import SkillsShSkill
from skill_manager.application.marketplace.resolver import DetailEnrichment
from skill_manager.sources import GitHubRepoMetadata, GitHubRepoMetadataClient

_FIXTURE_SKILLS = [
    SkillsShSkill(
        repo="mode-io/skills",
        skill_id="mode-switch",
        name="Mode Switch",
        installs=128,
        description_hint="Switch between supported skill execution modes.",
    ),
    SkillsShSkill(
        repo="vercel-labs/skills",
        skill_id="trace-scout",
        name="Trace Scout",
        installs=84,
        description_hint="Review traces and highlight suspicious flows.",
    ),
    SkillsShSkill(
        repo="microsoft/github-copilot-for-azure",
        skill_id="azure-observability",
        name="Azure Observability",
        installs=32,
        description_hint="Investigate Azure telemetry and platform health.",
    ),
    SkillsShSkill(
        repo="mode-io/skills",
        skill_id="switch-audit",
        name="Switch Audit",
        installs=12,
        description_hint="Audit switch transitions across environments.",
    ),
]

_FIXTURE_DETAIL_DESCRIPTIONS = {
    "mode-switch": "Switch between supported skill execution modes.",
    "trace-scout": "Review traces and highlight suspicious flows.",
    "azure-observability": "Investigate Azure telemetry and platform health.",
    "switch-audit": "Audit switch transitions across environments.",
}

_FIXTURE_FOLDER_URLS = {
    "mode-switch": "https://github.com/mode-io/skills/tree/main/skills/mode-switch",
    "trace-scout": "https://github.com/vercel-labs/skills/tree/main/skills/trace-scout",
    "azure-observability": "https://github.com/microsoft/github-copilot-for-azure/tree/main/skills/azure-observability",
    "switch-audit": "https://github.com/mode-io/skills/tree/main/skills/switch-audit",
}


def fixture_marketplace_search(query: str, limit: int) -> list[SkillsShSkill]:
    needle = query.strip().lower()
    filtered = [
        item
        for item in _FIXTURE_SKILLS
        if needle in item.name.lower() or needle in item.description_hint.lower()
    ]
    return filtered[:limit]


def create_fixture_marketplace_service() -> MarketplaceService:
    cache_root = Path(mkdtemp(prefix="skill-manager-marketplace-cache-"))
    cache = MarketplaceCache(cache_root)
    cache.write("leaderboard", "all-time", [skill_to_dict(item) for item in _FIXTURE_SKILLS])
    for skill in _FIXTURE_SKILLS:
        cache.write(
            "details",
            skill.detail_url,
            DetailEnrichment(
                description=_FIXTURE_DETAIL_DESCRIPTIONS[skill.skill_id],
                github_folder_url=_FIXTURE_FOLDER_URLS[skill.skill_id],
            ).to_dict(),
        )
    github_client = GitHubRepoMetadataClient(metadata_fetcher=_fixture_repo_metadata)
    return MarketplaceService(
        leaderboard_fetcher=lambda: list(_FIXTURE_SKILLS),
        search_fetcher=fixture_marketplace_search,
        detail_fetcher=lambda detail_url: "",
        github_client=github_client,
        cache=cache,
        warm_on_init=False,
    )


def _fixture_repo_metadata(repo: str) -> GitHubRepoMetadata | None:
    metadata = {
        "mode-io/skills": GitHubRepoMetadata(
            repo=repo,
            repo_url="https://github.com/mode-io/skills",
            owner_login="mode-io",
            owner_avatar_url="https://avatars.githubusercontent.com/u/424242?v=4",
            stars=512,
            default_branch="main",
        ),
        "vercel-labs/skills": GitHubRepoMetadata(
            repo=repo,
            repo_url="https://github.com/vercel-labs/skills",
            owner_login="vercel-labs",
            owner_avatar_url="https://avatars.githubusercontent.com/u/515151?v=4",
            stars=314,
            default_branch="main",
        ),
        "microsoft/github-copilot-for-azure": GitHubRepoMetadata(
            repo=repo,
            repo_url="https://github.com/microsoft/github-copilot-for-azure",
            owner_login="microsoft",
            owner_avatar_url="https://avatars.githubusercontent.com/u/615615?v=4",
            stars=271,
            default_branch="main",
        ),
    }
    return metadata.get(repo)


def skill_to_dict(skill: SkillsShSkill) -> dict[str, object]:
    return {
        "repo": skill.repo,
        "skillId": skill.skill_id,
        "name": skill.name,
        "installs": skill.installs,
        "descriptionHint": skill.description_hint,
    }
