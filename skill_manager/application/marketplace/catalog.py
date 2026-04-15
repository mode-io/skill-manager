from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import base64
from dataclasses import dataclass
import json
import subprocess
from threading import Thread
import time
from typing import Callable

from skill_manager.errors import MarketplaceUpstreamError
from skill_manager.sources import github_repo_url

from .cache import MarketplaceCache
from .client import DEFAULT_SKILLS_SH_BASE_URL, SkillsShClient
from .models import MarketplaceCard, MarketplacePageResult, RepoDisplayMetadata, SkillsShSkill
from .resolver import DetailEnrichment, GitHubSkillResolver
from .skillssh import (
    extract_detail_description,
    fetch_all_time_leaderboard,
    fetch_detail_page,
    search_skills,
)


LeaderboardFetcher = Callable[[], list[SkillsShSkill]]
SearchFetcher = Callable[[str, int], list[SkillsShSkill]]
DetailFetcher = Callable[[str], str]


@dataclass
class SearchSnapshot:
    items: tuple[SkillsShSkill, ...]
    fetched_limit: int
    maybe_more: bool
    fetched_at: float


class MarketplaceCatalog:
    DEFAULT_PAGE_SIZE = 20
    MAX_PAGE_SIZE = 60
    DETAIL_MISSING_FALLBACK = "No summary available on skills.sh."
    _LEADERBOARD_TTL_SECONDS = 3600
    _DETAIL_TTL_SECONDS = 86400
    _DETAIL_NAMESPACE = "details-v2"
    _SEARCH_TTL_SECONDS = 900
    _SEARCH_FETCH_FLOOR = 40
    _SEARCH_CACHE_LIMIT = 24
    _SUMMARY_WORKERS = 6

    def __init__(
        self,
        *,
        leaderboard_fetcher: LeaderboardFetcher | None = None,
        search_fetcher: SearchFetcher | None = None,
        detail_fetcher: DetailFetcher | None = None,
        github_resolver: GitHubSkillResolver | None = None,
        cache: MarketplaceCache | None = None,
        warm_on_init: bool = True,
    ) -> None:
        self._leaderboard_fetcher = leaderboard_fetcher or fetch_all_time_leaderboard
        self._search_fetcher = search_fetcher or (lambda query, limit: search_skills(query, limit=limit))
        self._detail_fetcher = detail_fetcher or fetch_detail_page
        self._resolver = github_resolver or GitHubSkillResolver()
        self._cache = cache or MarketplaceCache()
        self._search_cache: dict[str, SearchSnapshot] = {}
        if warm_on_init:
            self._warm_leaderboard_async()

    @classmethod
    def from_environment(
        cls,
        env: dict[str, str] | None = None,
        *,
        leaderboard_fetcher: LeaderboardFetcher | None = None,
        search_fetcher: SearchFetcher | None = None,
        detail_fetcher: DetailFetcher | None = None,
        warm_on_init: bool = True,
    ) -> "MarketplaceCatalog":
        client = SkillsShClient.from_environment(env)
        return cls(
            leaderboard_fetcher=leaderboard_fetcher or (lambda: fetch_all_time_leaderboard(client=client)),
            search_fetcher=search_fetcher or (lambda query, limit: search_skills(query, limit=limit, client=client)),
            detail_fetcher=detail_fetcher or (lambda detail_url: fetch_detail_page(detail_url, client=client)),
            cache=MarketplaceCache.from_environment(env),
            warm_on_init=warm_on_init,
        )

    @property
    def cache(self) -> MarketplaceCache:
        return self._cache

    def close(self) -> None:
        self._resolver.close()

    def popular_page(self, *, limit: int | None = None, offset: int = 0) -> dict[str, object]:
        records = self._leaderboard_records()
        return self._page(records, limit=limit, offset=offset, prefer_description_hints=False).to_dict()

    def search_page(self, query: str, *, limit: int | None = None, offset: int = 0) -> dict[str, object]:
        trimmed = query.strip()
        if len(trimmed) < 2:
            raise ValueError("Enter at least 2 characters to search skills.sh.")
        page_limit = self._normalize_limit(limit)
        page_offset = max(offset, 0)
        fetch_limit = max(page_offset + page_limit + 1, self._SEARCH_FETCH_FLOOR)
        snapshot = self._search_snapshot(trimmed, fetch_limit=fetch_limit)
        items = list(snapshot.items)
        page_items = items[page_offset:page_offset + page_limit]
        has_more = len(items) > (page_offset + page_limit) or snapshot.maybe_more
        cards = tuple(self._build_cards(page_items, prefer_description_hints=True))
        next_offset = page_offset + len(cards) if has_more and cards else None
        return MarketplacePageResult(items=cards, next_offset=next_offset, has_more=has_more and bool(cards)).to_dict()

    def resolve_install_token(self, token: str) -> tuple[str, str] | None:
        try:
            padding = "=" * (-len(token) % 4)
            decoded = base64.urlsafe_b64decode(f"{token}{padding}".encode("ascii")).decode("utf-8")
            payload = json.loads(decoded)
        except Exception:  # noqa: BLE001
            return None
        if not isinstance(payload, list) or len(payload) != 2:
            return None
        source_kind, source_locator = payload
        if not isinstance(source_kind, str) or not isinstance(source_locator, str):
            return None
        return source_kind, source_locator

    def install_token(self, source_kind: str, source_locator: str) -> str:
        payload = json.dumps([source_kind, source_locator], separators=(",", ":")).encode("utf-8")
        return base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")

    def find_item(self, item_id: str) -> SkillsShSkill | None:
        parsed = self.parse_item_id(item_id)
        if parsed is None:
            return None
        repo, skill_id = parsed
        for record in self._leaderboard_records():
            if record.repo == repo and record.skill_id == skill_id:
                return record
        try:
            snapshot = self._search_snapshot(skill_id, fetch_limit=self._SEARCH_FETCH_FLOOR)
        except ValueError:
            return None
        for record in snapshot.items:
            if record.repo == repo and record.skill_id == skill_id:
                return record
        return None

    def repo_metadata(self, repo: str) -> RepoDisplayMetadata:
        return self._resolver.repo_metadata(repo)

    def detail_enrichment(self, record: SkillsShSkill) -> DetailEnrichment:
        cached = self._cached_detail(record)
        if cached is not None and cached.folder_resolution_complete and not self._needs_folder_refresh(cached):
            return cached

        summary = cached
        if summary is None or not self._is_usable_description(summary.description):
            summary = self._resolve_summary_enrichment_best_effort(record)

        repo_meta = self.repo_metadata(record.repo)
        folder_url = None
        try:
            folder_url = self._resolver.github_folder_url(
                record.repo,
                record.skill_id,
                default_branch=repo_meta.default_branch,
            )
        except (ValueError, subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
            folder_url = None

        detail = DetailEnrichment(
            description=summary.description,
            folder_url=folder_url,
            folder_resolution_complete=True,
        )
        self._cache.write(self._DETAIL_NAMESPACE, record.detail_url, detail.to_dict())
        return detail

    @staticmethod
    def parse_item_id(item_id: str) -> tuple[str, str] | None:
        if not item_id.startswith("skillssh:"):
            return None
        raw_value = item_id.removeprefix("skillssh:")
        if ":" not in raw_value:
            return None
        repo, skill_id = raw_value.rsplit(":", 1)
        if not repo or not skill_id:
            return None
        return repo, skill_id

    def _page(
        self,
        records: list[SkillsShSkill],
        *,
        limit: int | None,
        offset: int,
        prefer_description_hints: bool,
    ) -> MarketplacePageResult:
        page_limit = self._normalize_limit(limit)
        page_offset = max(offset, 0)
        page_records = records[page_offset:page_offset + page_limit]
        cards = tuple(self._build_cards(page_records, prefer_description_hints=prefer_description_hints))
        has_more = len(records) > (page_offset + page_limit)
        next_offset = page_offset + len(cards) if has_more and cards else None
        return MarketplacePageResult(items=cards, next_offset=next_offset, has_more=has_more and bool(cards))

    def _leaderboard_records(self) -> list[SkillsShSkill]:
        cached = self._cache.read("leaderboard", "all-time", ttl_seconds=self._LEADERBOARD_TTL_SECONDS)
        if cached is not None:
            if not cached.is_fresh:
                self._warm_leaderboard_async()
            return self._sort_records([self._skill_from_dict(item) for item in cached.payload if isinstance(item, dict)])
        records = self._sort_records(self._leaderboard_fetcher())
        self._cache.write("leaderboard", "all-time", [self._skill_to_dict(item) for item in records])
        return records

    def _search_snapshot(self, query: str, *, fetch_limit: int) -> SearchSnapshot:
        cached = self._search_cache.get(query)
        if cached is not None and (time.time() - cached.fetched_at) < self._SEARCH_TTL_SECONDS and cached.fetched_limit >= fetch_limit:
            return cached
        fetched = self._sort_records(self._search_fetcher(query, fetch_limit))
        snapshot = SearchSnapshot(
            items=tuple(fetched),
            fetched_limit=fetch_limit,
            maybe_more=len(fetched) >= fetch_limit,
            fetched_at=time.time(),
        )
        self._search_cache[query] = snapshot
        self._prune_search_cache()
        return snapshot

    def _build_cards(self, records: list[SkillsShSkill], *, prefer_description_hints: bool) -> list[MarketplaceCard]:
        metadata = self._repo_metadata(records)
        descriptions = self._page_descriptions(records, prefer_description_hints=prefer_description_hints)
        cards: list[MarketplaceCard] = []
        for record in records:
            repo_meta = metadata[record.repo]
            cards.append(
                MarketplaceCard(
                    id=f"skillssh:{record.repo}:{record.skill_id}",
                    name=record.name,
                    description=descriptions[record.detail_url],
                    installs=record.installs,
                    stars=repo_meta.stars,
                    repo_label=record.repo,
                    repo_url=github_repo_url(record.repo),
                    repo_image_url=repo_meta.image_url,
                    skills_detail_url=record.detail_url,
                    install_token=self.install_token("github", record.source_locator),
                )
            )
        return cards

    def _repo_metadata(self, records: list[SkillsShSkill]) -> dict[str, RepoDisplayMetadata]:
        repos = sorted({record.repo for record in records})
        if not repos:
            return {}
        return self._resolver.repo_metadata_for_repos(repos)

    def _page_descriptions(self, records: list[SkillsShSkill], *, prefer_description_hints: bool) -> dict[str, str]:
        if not records:
            return {}
        max_workers = min(self._SUMMARY_WORKERS, len(records))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            pairs = executor.map(
                lambda record: (
                    record.detail_url,
                    self._description_for_card(record, prefer_description_hints=prefer_description_hints),
                ),
                records,
            )
        return dict(pairs)

    def _description_for_card(self, record: SkillsShSkill, *, prefer_description_hints: bool) -> str:
        cached = self._cached_detail(record)
        if cached is not None and self._is_usable_description(cached.description):
            return cached.description
        if prefer_description_hints and self._is_usable_description(record.description_hint):
            return record.description_hint.strip()
        detail = self._resolve_summary_enrichment_best_effort(record)
        return detail.description

    def _cached_detail(self, record: SkillsShSkill) -> DetailEnrichment | None:
        detail_cache = self._cache.read(self._DETAIL_NAMESPACE, record.detail_url, ttl_seconds=self._DETAIL_TTL_SECONDS)
        if detail_cache is None or not isinstance(detail_cache.payload, dict):
            return None
        return DetailEnrichment.from_dict(detail_cache.payload)

    @staticmethod
    def _needs_folder_refresh(detail: DetailEnrichment) -> bool:
        return bool(detail.folder_url and "/tree/HEAD/" in detail.folder_url)

    def _resolve_summary_enrichment(self, record: SkillsShSkill) -> DetailEnrichment:
        description = record.description_hint.strip() if self._is_usable_description(record.description_hint) else ""
        document = self._detail_fetcher(record.detail_url)
        extracted_description = extract_detail_description(
            document,
            skill_name=record.name,
            description_hint=description,
        )
        if self._is_usable_description(extracted_description):
            description = extracted_description.strip()
        if not description:
            description = self.DETAIL_MISSING_FALLBACK
        detail = DetailEnrichment(
            description=description,
            folder_url=None,
            folder_resolution_complete=False,
        )
        self._cache.write(self._DETAIL_NAMESPACE, record.detail_url, detail.to_dict())
        return detail

    def _resolve_summary_enrichment_best_effort(self, record: SkillsShSkill) -> DetailEnrichment:
        try:
            return self._resolve_summary_enrichment(record)
        except MarketplaceUpstreamError:
            detail = DetailEnrichment(
                description=self._fallback_description(record),
                folder_url=None,
                folder_resolution_complete=False,
            )
            self._cache.write(self._DETAIL_NAMESPACE, record.detail_url, detail.to_dict())
            return detail

    def _warm_leaderboard_async(self) -> None:
        Thread(target=self._refresh_leaderboard, daemon=True).start()

    def _refresh_leaderboard(self) -> None:
        try:
            records = self._sort_records(self._leaderboard_fetcher())
        except MarketplaceUpstreamError:
            return
        self._cache.write("leaderboard", "all-time", [self._skill_to_dict(item) for item in records])

    @staticmethod
    def _skill_to_dict(skill: SkillsShSkill) -> dict[str, object]:
        return {
            "repo": skill.repo,
            "skillId": skill.skill_id,
            "name": skill.name,
            "installs": skill.installs,
            "descriptionHint": skill.description_hint,
            "detailBaseUrl": skill.detail_base_url,
        }

    @staticmethod
    def _skill_from_dict(payload: dict[str, object]) -> SkillsShSkill:
        repo = payload.get("repo", "")
        skill_id = payload.get("skillId", "")
        name = payload.get("name", skill_id)
        installs = payload.get("installs", 0)
        description_hint = payload.get("descriptionHint", "")
        detail_base_url = payload.get("detailBaseUrl", "")
        return SkillsShSkill(
            repo=repo if isinstance(repo, str) else "",
            skill_id=skill_id if isinstance(skill_id, str) else "",
            name=name if isinstance(name, str) else "",
            installs=int(installs or 0),
            description_hint=description_hint if isinstance(description_hint, str) else "",
            detail_base_url=(
                detail_base_url
                if isinstance(detail_base_url, str) and detail_base_url
                else DEFAULT_SKILLS_SH_BASE_URL
            ),
        )

    @staticmethod
    def _sort_records(records: list[SkillsShSkill]) -> list[SkillsShSkill]:
        return sorted(
            records,
            key=lambda item: (-item.installs, item.name.lower(), item.repo.lower(), item.skill_id.lower()),
        )

    @classmethod
    def _normalize_limit(cls, limit: int | None) -> int:
        if limit is None:
            return cls.DEFAULT_PAGE_SIZE
        return max(1, min(limit, cls.MAX_PAGE_SIZE))

    def _prune_search_cache(self) -> None:
        if len(self._search_cache) <= self._SEARCH_CACHE_LIMIT:
            return
        ordered = sorted(self._search_cache.items(), key=lambda item: item[1].fetched_at, reverse=True)
        self._search_cache = dict(ordered[:self._SEARCH_CACHE_LIMIT])

    @staticmethod
    def _is_usable_description(value: str | None) -> bool:
        return isinstance(value, str) and bool(value.strip())

    def _fallback_description(self, record: SkillsShSkill) -> str:
        if self._is_usable_description(record.description_hint):
            return record.description_hint.strip()
        return self.DETAIL_MISSING_FALLBACK
