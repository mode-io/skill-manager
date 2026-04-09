from __future__ import annotations

from dataclasses import dataclass
import os

from skill_manager.harness import CommandRunner

from .marketplace import (
    MarketplaceCatalog,
    MarketplaceDocumentService,
    MarketplaceInstallService,
    MarketplaceQueryService,
)
from .read_model_service import ReadModelService
from .skills import SkillsMutationService, SkillsQueryService
from .source_fetch_service import SourceFetchService


@dataclass(frozen=True)
class BackendContainer:
    read_models: ReadModelService
    source_fetcher: SourceFetchService
    skills_queries: SkillsQueryService
    skills_mutations: SkillsMutationService
    marketplace_catalog: MarketplaceCatalog
    marketplace_documents: MarketplaceDocumentService
    marketplace_queries: MarketplaceQueryService
    marketplace_installs: MarketplaceInstallService


def build_backend_container(
    env: dict[str, str] | None = None,
    *,
    command_runner: CommandRunner | None = None,
    marketplace_catalog: MarketplaceCatalog | None = None,
) -> BackendContainer:
    active_env = dict(os.environ)
    if env is not None:
        active_env.update(env)

    read_models = ReadModelService.from_environment(active_env, command_runner=command_runner)
    source_fetcher = SourceFetchService()
    catalog = marketplace_catalog or MarketplaceCatalog.from_environment(active_env)
    skills_queries = SkillsQueryService(read_models, source_fetcher)
    skills_mutations = SkillsMutationService(read_models, skills_queries, source_fetcher)
    marketplace_documents = MarketplaceDocumentService(source_fetcher, cache=catalog.cache)
    marketplace_queries = MarketplaceQueryService(read_models, catalog, marketplace_documents)
    marketplace_installs = MarketplaceInstallService(catalog, skills_mutations)
    return BackendContainer(
        read_models=read_models,
        source_fetcher=source_fetcher,
        skills_queries=skills_queries,
        skills_mutations=skills_mutations,
        marketplace_catalog=catalog,
        marketplace_documents=marketplace_documents,
        marketplace_queries=marketplace_queries,
        marketplace_installs=marketplace_installs,
    )
