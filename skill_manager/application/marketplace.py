from __future__ import annotations

from dataclasses import dataclass
import json
import time
from urllib.request import Request, urlopen

from skill_manager.sources import search_agentskill, search_skillssh
from skill_manager.sources.github import github_repo_from_locator
from skill_manager.sources.types import SkillListing

_CACHE_TTL_SECONDS = 900
_TIMEOUT_SECONDS = 10


@dataclass(frozen=True)
class MarketplaceItem:
    name: str
    description: str
    source_kind: str
    source_locator: str
    registry: str
    installs: int
    github_repo: str | None
    github_stars: int
    badge: str

    @property
    def popularity(self) -> int:
        return self.github_stars if self.github_stars > 0 else self.installs

    def to_dict(self) -> dict[str, object]:
        return {
            "id": f"{self.source_kind}:{self.source_locator}",
            "name": self.name,
            "description": self.description,
            "sourceKind": self.source_kind,
            "sourceLocator": self.source_locator,
            "registry": self.registry,
            "installs": self.installs,
            "githubRepo": self.github_repo,
            "githubStars": self.github_stars,
            "badge": self.badge,
            "popularity": self.popularity,
        }


class MarketplaceService:
    def __init__(self) -> None:
        self._github_star_cache: dict[str, tuple[float, int]] = {}

    def popular(self) -> list[dict[str, object]]:
        return [item.to_dict() for item in self._normalize(self._search_all(""))]

    def search(self, query: str) -> list[dict[str, object]]:
        if not query.strip():
            return self.popular()
        return [item.to_dict() for item in self._normalize(self._search_all(query))]

    def _search_all(self, query: str) -> list[SkillListing]:
        listings: list[SkillListing] = []
        for searcher in (search_skillssh, search_agentskill):
            try:
                listings.extend(searcher(query, limit=12))
            except Exception:  # noqa: BLE001
                continue
        return listings

    def _normalize(self, listings: list[SkillListing]) -> list[MarketplaceItem]:
        deduped: dict[tuple[str, str], MarketplaceItem] = {}
        for listing in listings:
            repo = listing.github_repo
            if repo is None and listing.source_kind == "github":
                repo = github_repo_from_locator(listing.source_locator)
            stars = listing.github_stars
            if stars <= 0 and repo:
                stars = self._github_stars(repo)
            item = MarketplaceItem(
                name=listing.name,
                description=listing.description,
                source_kind=listing.source_kind,
                source_locator=listing.source_locator,
                registry=listing.registry,
                installs=listing.installs,
                github_repo=repo,
                github_stars=stars,
                badge="Official" if listing.source_kind == "github" else "Community",
            )
            key = (item.source_kind, item.source_locator)
            current = deduped.get(key)
            if current is None or (item.popularity, item.installs) > (current.popularity, current.installs):
                deduped[key] = item
        return sorted(
            deduped.values(),
            key=lambda item: (-item.popularity, -item.installs, item.name.lower(), item.source_locator),
        )

    def _github_stars(self, repo: str) -> int:
        cached = self._github_star_cache.get(repo)
        now = time.time()
        if cached is not None and (now - cached[0]) < _CACHE_TTL_SECONDS:
            return cached[1]

        request = Request(
            f"https://api.github.com/repos/{repo}",
            headers={
                "Accept": "application/vnd.github+json",
                "User-Agent": "skill-manager/0.1",
            },
        )
        try:
            with urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
                payload = json.loads(response.read().decode("utf-8"))
            stars = int(payload.get("stargazers_count", 0))
        except Exception:  # noqa: BLE001
            stars = 0
        self._github_star_cache[repo] = (now, stars)
        return stars
