from __future__ import annotations

import os
from dataclasses import dataclass

from skill_manager.paths import AppPaths, resolve_app_paths
from skill_manager.store import HarnessSupportStore

from .marketplace import (
    MarketplaceCatalog,
    MarketplaceDocumentService,
    MarketplaceInstallService,
    MarketplaceQueryService,
)
from .read_model_service import ReadModelService
from .settings import SettingsMutationService, SettingsQueryService
from .skills import SkillsMutationService, SkillsQueryService
from .source_fetch_service import SourceFetchService


@dataclass(frozen=True)
class BackendContainer:
    paths: AppPaths
    read_models: ReadModelService
    support_store: HarnessSupportStore
    source_fetcher: SourceFetchService
    skills_queries: SkillsQueryService
    skills_mutations: SkillsMutationService
    settings_queries: SettingsQueryService
    settings_mutations: SettingsMutationService
    marketplace_catalog: MarketplaceCatalog
    marketplace_documents: MarketplaceDocumentService
    marketplace_queries: MarketplaceQueryService
    marketplace_installs: MarketplaceInstallService


def build_backend_container(
    env: dict[str, str] | None = None,
    *,
    marketplace_catalog: MarketplaceCatalog | None = None,
    source_fetcher: SourceFetchService | None = None,
) -> BackendContainer:
    active_env = dict(os.environ)
    if env is not None:
        active_env.update(env)

    paths = resolve_app_paths(active_env)
    support_store = HarnessSupportStore(paths.settings_path)
    read_models = ReadModelService.from_environment(active_env, support_store=support_store)
    active_source_fetcher = source_fetcher or SourceFetchService()
    catalog = marketplace_catalog or MarketplaceCatalog.from_environment(active_env)
    skills_queries = SkillsQueryService(read_models, active_source_fetcher)
    skills_mutations = SkillsMutationService(read_models, skills_queries, active_source_fetcher)
    settings_queries = SettingsQueryService(read_models, support_store)
    settings_mutations = SettingsMutationService(read_models, support_store)
    marketplace_documents = MarketplaceDocumentService(active_source_fetcher, cache=catalog.cache)
    marketplace_queries = MarketplaceQueryService(read_models, catalog, marketplace_documents)
    marketplace_installs = MarketplaceInstallService(catalog, skills_mutations)
    return BackendContainer(
        paths=paths,
        read_models=read_models,
        support_store=support_store,
        source_fetcher=active_source_fetcher,
        skills_queries=skills_queries,
        skills_mutations=skills_mutations,
        settings_queries=settings_queries,
        settings_mutations=settings_mutations,
        marketplace_catalog=catalog,
        marketplace_documents=marketplace_documents,
        marketplace_queries=marketplace_queries,
        marketplace_installs=marketplace_installs,
    )
