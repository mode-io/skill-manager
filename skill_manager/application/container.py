from __future__ import annotations

import os
from dataclasses import dataclass

from skill_manager.harness import HarnessKernelService, HarnessSupportStore
from skill_manager.paths import AppPaths, resolve_app_paths

from .cli_marketplace import CliMarketplaceCatalog
from .invalidation import InvalidationFanout
from .mcp.enrichment import McpEnrichmentService
from .mcp.installers import McpInstallProvider, SmitheryCliInstallProvider
from .mcp.marketplace import McpMarketplaceCatalog
from .mcp.mutations import McpMutationService
from .mcp.planner import McpAdoptionPlanner
from .mcp.query import McpQueryService
from .mcp.read_models import McpReadModelService
from .mcp.store import McpServerStore
from .settings import SettingsMutationService, SettingsQueryService
from .slash_commands import (
    SlashCommandMutationService,
    SlashCommandQueryService,
    SlashCommandStore,
    SlashCommandStorePaths,
    resolve_slash_targets,
    slash_manager_root,
)
from .skills import SkillsMutationService, SkillsQueryService
from .skills.marketplace import (
    MarketplaceCatalog,
    MarketplaceDocumentService,
    MarketplaceInstallService,
    MarketplaceQueryService,
)
from .skills.read_models import SkillsReadModelService
from .skills.source_fetch import SourceFetchService
from .skills.store import SkillStore
from .marketplace_cache import MarketplaceCache


@dataclass(frozen=True)
class BackendContainer:
    paths: AppPaths
    harness_kernel: HarnessKernelService
    support_store: HarnessSupportStore
    invalidation: InvalidationFanout
    skills_source_fetcher: SourceFetchService
    skills_store: SkillStore
    skills_read_models: SkillsReadModelService
    skills_queries: SkillsQueryService
    skills_mutations: SkillsMutationService
    settings_queries: SettingsQueryService
    settings_mutations: SettingsMutationService
    slash_command_store: SlashCommandStore
    slash_command_queries: SlashCommandQueryService
    slash_command_mutations: SlashCommandMutationService
    skills_marketplace_catalog: MarketplaceCatalog
    skills_marketplace_documents: MarketplaceDocumentService
    skills_marketplace_queries: MarketplaceQueryService
    skills_marketplace_installs: MarketplaceInstallService
    cli_marketplace_catalog: CliMarketplaceCatalog
    mcp_marketplace_catalog: McpMarketplaceCatalog
    mcp_store: McpServerStore
    mcp_read_models: McpReadModelService
    mcp_queries: McpQueryService
    mcp_mutations: McpMutationService


def build_backend_container(
    env: dict[str, str] | None = None,
    *,
    marketplace_catalog: MarketplaceCatalog | None = None,
    mcp_marketplace_catalog: McpMarketplaceCatalog | None = None,
    cli_marketplace_catalog: CliMarketplaceCatalog | None = None,
    source_fetcher: SourceFetchService | None = None,
    mcp_install_provider: McpInstallProvider | None = None,
) -> BackendContainer:
    active_env = dict(os.environ)
    if env is not None:
        active_env.update(env)

    paths = resolve_app_paths(active_env)
    support_store = HarnessSupportStore(paths.settings_path)
    harness_kernel = HarnessKernelService.from_environment(active_env, support_store=support_store)
    invalidation = InvalidationFanout()

    skills_store = SkillStore(paths.skills_store_root, manifest_path=paths.skills_store_manifest)
    skills_read_models = SkillsReadModelService.from_kernel(store=skills_store, kernel=harness_kernel)
    invalidation.register(skills_read_models)

    active_source_fetcher = source_fetcher or SourceFetchService()
    skills_queries = SkillsQueryService(skills_read_models, active_source_fetcher)
    skills_mutations = SkillsMutationService(skills_read_models, skills_queries, active_source_fetcher)
    settings_queries = SettingsQueryService(harness_kernel)
    slash_root = slash_manager_root(harness_kernel.context)
    slash_targets = resolve_slash_targets(harness_kernel.context)
    slash_command_store = SlashCommandStore(
        SlashCommandStorePaths(
            root=slash_root,
            commands_dir=slash_root / "commands",
            sync_state_path=slash_root / "sync-state.json",
        )
    )
    slash_command_queries = SlashCommandQueryService(slash_command_store, slash_targets)
    slash_command_mutations = SlashCommandMutationService(
        slash_command_store,
        slash_command_queries,
        slash_targets,
    )

    cache = MarketplaceCache.from_environment(active_env)
    skills_catalog = marketplace_catalog or MarketplaceCatalog.from_environment(
        active_env,
        cache=cache,
        warm_on_init=False,
    )
    skills_documents = MarketplaceDocumentService(active_source_fetcher, cache=cache)
    skills_marketplace_queries = MarketplaceQueryService(skills_read_models, skills_catalog, skills_documents)
    skills_marketplace_installs = MarketplaceInstallService(skills_catalog, skills_mutations)
    cli_catalog = cli_marketplace_catalog or CliMarketplaceCatalog.from_environment(
        active_env,
        cache=cache,
    )

    mcp_store = McpServerStore(paths.mcp_store_manifest)
    mcp_read_models = McpReadModelService.from_kernel(store=mcp_store, kernel=harness_kernel)
    invalidation.register(mcp_read_models)
    settings_mutations = SettingsMutationService(harness_kernel, support_store, invalidation)

    mcp_catalog = mcp_marketplace_catalog or McpMarketplaceCatalog.from_environment(
        active_env,
        cache=cache,
    )
    mcp_enrichment = McpEnrichmentService(mcp_catalog)
    mcp_planner = McpAdoptionPlanner(mcp_read_models)
    mcp_queries = McpQueryService(
        mcp_read_models,
        planner=mcp_planner,
        enrichment=mcp_enrichment,
    )
    mcp_mutations = McpMutationService(
        store=mcp_store,
        read_models=mcp_read_models,
        planner=mcp_planner,
        marketplace_catalog=mcp_catalog,
        install_provider=mcp_install_provider or SmitheryCliInstallProvider(env=active_env),
        enrichment=mcp_enrichment,
    )

    return BackendContainer(
        paths=paths,
        harness_kernel=harness_kernel,
        support_store=support_store,
        invalidation=invalidation,
        skills_source_fetcher=active_source_fetcher,
        skills_store=skills_store,
        skills_read_models=skills_read_models,
        skills_queries=skills_queries,
        skills_mutations=skills_mutations,
        settings_queries=settings_queries,
        settings_mutations=settings_mutations,
        slash_command_store=slash_command_store,
        slash_command_queries=slash_command_queries,
        slash_command_mutations=slash_command_mutations,
        skills_marketplace_catalog=skills_catalog,
        skills_marketplace_documents=skills_documents,
        skills_marketplace_queries=skills_marketplace_queries,
        skills_marketplace_installs=skills_marketplace_installs,
        cli_marketplace_catalog=cli_catalog,
        mcp_marketplace_catalog=mcp_catalog,
        mcp_store=mcp_store,
        mcp_read_models=mcp_read_models,
        mcp_queries=mcp_queries,
        mcp_mutations=mcp_mutations,
    )
