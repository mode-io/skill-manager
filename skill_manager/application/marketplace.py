from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol
from urllib.parse import quote

from skill_manager.sources import (
    GitHubAvatarAsset,
    GitHubIdentitySnapshot,
    GitHubRepoMetadataClient,
    browse_skillssh,
    github_repo_from_locator,
    github_repo_url,
    search_agentskill,
    search_skillssh,
)
from skill_manager.sources.types import SkillListing
from .marketplace_descriptions import MarketplaceDescriptionResolver


class MarketplaceSearchProvider(Protocol):
    def __call__(self, query: str, *, limit: int = 20) -> list[SkillListing]:
        ...


@dataclass(frozen=True)
class MarketplaceGitHubIdentity:
    repo: str | None
    url: str | None
    owner_login: str | None
    avatar_path: str | None
    stars: int

    def to_dict(self) -> dict[str, object]:
        return {
            "repo": self.repo,
            "url": self.url,
            "ownerLogin": self.owner_login,
            "avatarPath": self.avatar_path,
            "stars": self.stars,
        }


@dataclass(frozen=True)
class MarketplaceCandidate:
    name: str
    description_hint: str | None
    source_kind: str
    source_locator: str
    registry: str
    installs: int
    github: MarketplaceGitHubIdentity | None

    @property
    def popularity(self) -> int:
        github_stars = self.github.stars if self.github is not None else 0
        return github_stars if github_stars > 0 else self.installs


@dataclass(frozen=True)
class MarketplaceItem:
    name: str
    description: str | None
    description_status: str
    source_kind: str
    source_locator: str
    registry: str
    github: MarketplaceGitHubIdentity | None

    def to_dict(self) -> dict[str, object]:
        return {
            "id": f"{self.source_kind}:{self.source_locator}",
            "name": self.name,
            "description": self.description,
            "descriptionStatus": self.description_status,
            "sourceKind": self.source_kind,
            "sourceLocator": self.source_locator,
            "registry": self.registry,
            "github": self.github.to_dict() if self.github is not None else None,
        }


@dataclass(frozen=True)
class MarketplacePageResult:
    items: tuple[MarketplaceItem, ...]
    next_offset: int | None
    has_more: bool

    def to_dict(self) -> dict[str, object]:
        return {
            "items": [item.to_dict() for item in self.items],
            "nextOffset": self.next_offset,
            "hasMore": self.has_more,
        }


class MarketplaceService:
    DEFAULT_PAGE_SIZE = 18
    MAX_PAGE_SIZE = 60

    def __init__(
        self,
        *,
        searchers: tuple[MarketplaceSearchProvider, ...] | None = None,
        browse_searchers: tuple[MarketplaceSearchProvider, ...] | None = None,
        github_client: GitHubRepoMetadataClient | None = None,
        description_resolver: MarketplaceDescriptionResolver | None = None,
    ) -> None:
        resolved_searchers = searchers or (search_skillssh, search_agentskill)
        self._searchers = resolved_searchers
        self._browse_searchers = browse_searchers or (resolved_searchers if searchers is not None else (browse_skillssh, search_agentskill))
        self.github_client = github_client or GitHubRepoMetadataClient()
        self.description_resolver = description_resolver or MarketplaceDescriptionResolver()

    def popular_page(self, *, limit: int | None = None, offset: int = 0) -> dict[str, object]:
        return self._page("", limit=limit, offset=offset).to_dict()

    def search_page(self, query: str, *, limit: int | None = None, offset: int = 0) -> dict[str, object]:
        if not query.strip():
            return self.popular_page(limit=limit, offset=offset)
        return self._page(query, limit=limit, offset=offset).to_dict()

    def avatar_for_repo(self, repo: str) -> GitHubAvatarAsset | None:
        return self.github_client.avatar_for_repo(repo)

    def avatar_for_owner(self, owner: str) -> GitHubAvatarAsset | None:
        return self.github_client.avatar_for_owner(owner)

    def _search_all(self, query: str, *, per_source_limit: int) -> tuple[list[SkillListing], bool]:
        listings: list[SkillListing] = []
        maybe_more = False
        active_searchers = self._browse_searchers if not query.strip() else self._searchers
        for searcher in active_searchers:
            try:
                results = searcher(query, limit=per_source_limit)
            except Exception:  # noqa: BLE001
                continue
            listings.extend(results)
            if len(results) >= per_source_limit:
                maybe_more = True
        return listings, maybe_more

    def _normalize_candidates(self, listings: list[SkillListing]) -> list[MarketplaceCandidate]:
        deduped: dict[tuple[str, str], MarketplaceCandidate] = {}
        for listing in listings:
            repo = listing.github_repo
            if (repo is None or repo.count("/") != 1) and listing.source_kind == "github":
                repo = github_repo_from_locator(listing.source_locator)
            owner_login = listing.github_owner
            if (owner_login is None or not owner_login) and isinstance(repo, str) and repo.count("/") == 1:
                owner_login = repo.split("/", 1)[0]
            github = self._github_identity(
                snapshot=self.github_client.identity_snapshot(repo=repo, owner=owner_login),
                stars_hint=listing.github_stars,
            )
            item = MarketplaceCandidate(
                name=listing.name,
                description_hint=listing.description_hint,
                source_kind=listing.source_kind,
                source_locator=listing.source_locator,
                registry=listing.registry,
                installs=listing.installs,
                github=github,
            )
            key = (item.source_kind, item.source_locator)
            current = deduped.get(key)
            if current is None or (item.popularity, item.installs) > (current.popularity, current.installs):
                deduped[key] = item
        return sorted(
            deduped.values(),
            key=lambda item: (-item.popularity, -item.installs, item.name.lower(), item.source_locator),
        )

    def _page(self, query: str, *, limit: int | None, offset: int) -> MarketplacePageResult:
        page_limit = self._normalize_limit(limit)
        page_offset = max(offset, 0)
        fetch_count = page_offset + page_limit + 1
        listings, maybe_more = self._search_all(query, per_source_limit=fetch_count)
        normalized = self._normalize_candidates(listings)
        page_candidates = normalized[page_offset:page_offset + page_limit]
        page_items = tuple(self._materialize_item(candidate) for candidate in page_candidates)
        has_more = len(normalized) > (page_offset + page_limit) or maybe_more
        next_offset = page_offset + len(page_candidates) if has_more and page_candidates else None
        return MarketplacePageResult(
            items=page_items,
            next_offset=next_offset,
            has_more=has_more and bool(page_candidates),
        )

    def _github_identity(
        self,
        *,
        snapshot: GitHubIdentitySnapshot,
        stars_hint: int,
    ) -> MarketplaceGitHubIdentity | None:
        repo_name = snapshot.repo
        resolved_owner = snapshot.owner
        star_count = snapshot.stars if snapshot.stars > 0 else stars_hint
        if repo_name is None and resolved_owner is None and star_count <= 0:
            return None

        repo_url = snapshot.repo_url
        if repo_url is None and repo_name is not None:
            repo_url = github_repo_url(repo_name)
        if repo_url is None:
            repo_url = snapshot.owner_url

        avatar_path: str | None = None
        if repo_name is not None:
            avatar_path = self._avatar_path(repo=repo_name)
        elif resolved_owner is not None:
            avatar_path = self._avatar_path(owner=resolved_owner)

        return MarketplaceGitHubIdentity(
            repo=repo_name,
            url=repo_url,
            owner_login=resolved_owner,
            avatar_path=avatar_path,
            stars=star_count,
        )

    @staticmethod
    def _avatar_path(*, repo: str | None = None, owner: str | None = None) -> str:
        if repo is not None:
            return f"/marketplace/avatar?repo={quote(repo, safe='')}"
        if owner is not None:
            return f"/marketplace/avatar?owner={quote(owner, safe='')}"
        raise ValueError("repo or owner is required for an avatar path")

    @classmethod
    def _normalize_limit(cls, limit: int | None) -> int:
        if limit is None:
            return cls.DEFAULT_PAGE_SIZE
        return max(1, min(limit, cls.MAX_PAGE_SIZE))

    def _materialize_item(self, candidate: MarketplaceCandidate) -> MarketplaceItem:
        description = self.description_resolver.resolve(
            source_kind=candidate.source_kind,
            source_locator=candidate.source_locator,
            description_hint=candidate.description_hint,
        )
        return MarketplaceItem(
            name=candidate.name,
            description=description.description,
            description_status=description.status,
            source_kind=candidate.source_kind,
            source_locator=candidate.source_locator,
            registry=candidate.registry,
            github=candidate.github,
        )
