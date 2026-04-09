from __future__ import annotations

import os

from skill_manager.harness import CommandRunner
from skill_manager.harness.link_operator import LinkOperator, MutationError

from .marketplace import MarketplaceService
from .marketplace.resolver import GitHubSkillResolver
from .read_model_service import ReadModelService
from .skills_mutation_service import SkillsMutationService
from .skills_query_service import SkillsQueryService
from .source_fetch_service import SourceFetchService


class ApplicationService:
    def __init__(
        self,
        read_models: ReadModelService,
        *,
        marketplace: MarketplaceService | None = None,
        github_resolver: GitHubSkillResolver | None = None,
    ) -> None:
        self.read_models = read_models
        self.marketplace = marketplace or MarketplaceService()
        self.source_fetcher = SourceFetchService()
        self.skills_queries = SkillsQueryService(
            self.read_models,
            self.source_fetcher,
            github_resolver=github_resolver,
        )
        self.skills_mutations = SkillsMutationService(self.read_models, self.skills_queries, self.source_fetcher)

    @classmethod
    def from_environment(
        cls,
        env: dict[str, str] | None = None,
        *,
        command_runner: CommandRunner | None = None,
    ) -> "ApplicationService":
        active_env = dict(os.environ)
        if env is not None:
            active_env.update(env)
        return cls(
            ReadModelService.from_environment(active_env, command_runner=command_runner),
            marketplace=MarketplaceService.from_environment(active_env),
        )

    def health(self) -> dict[str, object]:
        return self.skills_queries.health()

    def list_skills(self) -> dict[str, object]:
        return self.skills_queries.list_skills()

    def get_skill_detail(self, skill_ref: str) -> dict[str, object] | None:
        return self.skills_queries.get_skill_detail(skill_ref)

    def enable_skill(self, skill_ref: str, harness: str) -> dict[str, bool]:
        return self.skills_mutations.enable_skill(skill_ref, harness)

    def disable_skill(self, skill_ref: str, harness: str) -> dict[str, bool]:
        return self.skills_mutations.disable_skill(skill_ref, harness)

    def manage_skill(self, skill_ref: str) -> dict[str, bool]:
        return self.skills_mutations.manage_skill(skill_ref)

    def manage_all_skills(self) -> dict[str, object]:
        return self.skills_mutations.manage_all_skills()

    def update_skill(self, skill_ref: str) -> dict[str, bool]:
        return self.skills_mutations.update_skill(skill_ref)

    def unmanage_skill(self, skill_ref: str) -> dict[str, bool]:
        return self.skills_mutations.unmanage_skill(skill_ref)

    def delete_skill(self, skill_ref: str) -> dict[str, bool]:
        return self.skills_mutations.delete_skill(skill_ref)

    def popular_marketplace(self, *, limit: int | None = None, offset: int = 0) -> dict[str, object]:
        return self.marketplace.popular_page(limit=limit, offset=offset)

    def search_marketplace(self, query: str, *, limit: int | None = None, offset: int = 0) -> dict[str, object]:
        try:
            return self.marketplace.search_page(query, limit=limit, offset=offset)
        except ValueError as error:
            raise MutationError(str(error), status=400) from error

    def install_skill(self, install_token: str) -> dict[str, bool]:
        descriptor = self.marketplace.resolve_install_token(install_token)
        if descriptor is None:
            raise MutationError("unknown marketplace install token", status=400)
        source_kind, source_locator = descriptor
        return self.skills_mutations.install_skill(source_kind=source_kind, source_locator=source_locator)

    def settings(self) -> dict[str, object]:
        return self.skills_queries.settings()
