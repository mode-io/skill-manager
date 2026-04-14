from __future__ import annotations

from pathlib import Path
from tempfile import mkdtemp

from skill_manager.application.marketplace import MarketplaceCatalog
from skill_manager.application.marketplace.cache import MarketplaceCache
from skill_manager.application.marketplace.models import SkillsShSkill
from skill_manager.application.marketplace.repo_snapshots import GitHubRepoSnapshotService
from skill_manager.application.marketplace.resolver import DetailEnrichment, GitHubSkillResolver
from skill_manager.sources import GitHubRepoMetadata, GitHubRepoMetadataClient
from tests.support.marketplace_payloads import FIXTURE_FOLDER_URLS, FIXTURE_SKILLS


def fixture_marketplace_search(query: str, limit: int) -> list[SkillsShSkill]:
    needle = query.strip().lower()
    filtered = [
        item_from_payload(item)
        for item in FIXTURE_SKILLS
        if needle in item["name"].lower() or needle in item["description"].lower()
    ]
    return filtered[:limit]


def create_fixture_marketplace_service() -> MarketplaceCatalog:
    cache_root = Path(mkdtemp(prefix="skill-manager-marketplace-cache-"))
    cache = MarketplaceCache(cache_root)
    skills = [item_from_payload(item) for item in FIXTURE_SKILLS]
    cache.write("leaderboard", "all-time", [skill_to_dict(item) for item in skills])
    for skill in skills:
        cache.write(
            "details",
            skill.detail_url,
            DetailEnrichment(
                description=next(item["description"] for item in FIXTURE_SKILLS if item["skillId"] == skill.skill_id),
                github_folder_url=FIXTURE_FOLDER_URLS[skill.skill_id],
                folder_resolution_complete=True,
            ).to_dict(),
        )
    snapshot_service = GitHubRepoSnapshotService(
        cache=cache,
        metadata_client=GitHubRepoMetadataClient(metadata_fetcher=_fixture_repo_metadata),
    )
    for repo in {skill.repo for skill in skills}:
        snapshot_service.refresh_repo_now(repo)
    return MarketplaceCatalog(
        leaderboard_fetcher=lambda: list(skills),
        search_fetcher=fixture_marketplace_search,
        detail_fetcher=lambda detail_url: "",
        github_resolver=GitHubSkillResolver(snapshot_service),
        cache=cache,
        warm_on_init=False,
    )


def _fixture_repo_metadata(repo: str) -> GitHubRepoMetadata | None:
    metadata = {
        "mode-io/skills": GitHubRepoMetadata(
            repo=repo,
            repo_url="https://github.com/mode-io/skills",
            stars=512,
            default_branch="main",
        ),
        "vercel-labs/skills": GitHubRepoMetadata(
            repo=repo,
            repo_url="https://github.com/vercel-labs/skills",
            stars=314,
            default_branch="main",
        ),
        "microsoft/github-copilot-for-azure": GitHubRepoMetadata(
            repo=repo,
            repo_url="https://github.com/microsoft/github-copilot-for-azure",
            stars=271,
            default_branch="main",
        ),
    }
    return metadata.get(repo)


def item_from_payload(payload: dict[str, object]) -> SkillsShSkill:
    return SkillsShSkill(
        repo=str(payload["repo"]),
        skill_id=str(payload["skillId"]),
        name=str(payload["name"]),
        installs=int(payload["installs"]),
        description_hint=str(payload["description"]),
    )


def skill_to_dict(skill: SkillsShSkill) -> dict[str, object]:
    return {
        "repo": skill.repo,
        "skillId": skill.skill_id,
        "name": skill.name,
        "installs": skill.installs,
        "descriptionHint": skill.description_hint,
        "detailBaseUrl": skill.detail_base_url,
    }
