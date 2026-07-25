from __future__ import annotations

import os
import shutil
from dataclasses import dataclass

from skill_manager.atomic_files import file_lock
from skill_manager.harness import HarnessKernelService, HarnessSupportStore
from skill_manager.harness.resolution import resolve_context
from skill_manager.paths import AppPaths, resolve_app_paths

from .agents import (
    AgentHarnessAdapter,
    AgentInventoryService,
    AgentMutationService,
    AgentStore,
    resolve_agent_targets,
)
from .cli_marketplace import CliMarketplaceCatalog
from .hooks import (
    HooksMutationService,
    HooksQueryService,
    HooksReadModelService,
    HookStore,
)
from .invalidation import InvalidationFanout
from .marketplace_cache import MarketplaceCache
from .mcp.availability import McpAvailabilityProbe
from .mcp.enrichment import McpEnrichmentService
from .mcp.marketplace import McpMarketplaceCatalog
from .mcp.mutations import McpMutationService
from .mcp.planner import McpAdoptionPlanner
from .mcp.query import McpQueryService
from .mcp.read_models import McpReadModelService
from .mcp.store import McpServerStore
from .permissions import (
    PermissionsMutationService,
    PermissionsQueryService,
    PermissionsReadModelService,
    PermissionStore,
)
from .scaffold import ScaffoldService
from .settings import SettingsMutationService, SettingsQueryService
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
from .slash_commands import (
    SlashCommandMutationService,
    SlashCommandPathPolicy,
    SlashCommandPlanner,
    SlashCommandQueryService,
    SlashCommandReadModelService,
    SlashCommandStore,
    SlashCommandStorePaths,
    SlashCommandSyncStateStore,
    migrate_legacy_slash_commands,
    resolve_slash_targets,
)


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
    slash_command_sync_state: SlashCommandSyncStateStore
    slash_command_read_models: SlashCommandReadModelService
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
    hooks_store: HookStore
    hooks_read_models: HooksReadModelService
    hooks_queries: HooksQueryService
    hooks_mutations: HooksMutationService
    permissions_store: PermissionStore
    permissions_read_models: PermissionsReadModelService
    permissions_queries: PermissionsQueryService
    permissions_mutations: PermissionsMutationService
    scaffold_service: ScaffoldService
    agents_store: AgentStore
    agents_inventory: AgentInventoryService
    agents_mutations: AgentMutationService
    app_home: Path


def _migrate_legacy_layouts(data_dir: Path, skills_store_root: Path, agents_root: Path) -> None:
    """Migrate old storage layouts into the new flat layout.

    Handles two old shapes:
      - pre-package: ``data_dir/shared`` → ``data_dir/skills``
      - package-layout: ``data_dir/packages/local/skills`` → ``data_dir/skills``
    and similarly for agents: ``data_dir/packages/local/agents`` → ``data_dir/agents``.
    Also moves legacy manifest files.
    """
    skills_store_root.mkdir(parents=True, exist_ok=True)
    agents_root.mkdir(parents=True, exist_ok=True)

    lock_path = data_dir / ".migration.lock"
    with file_lock(lock_path):
        # Skills migration
        legacy_shared = data_dir / "shared"
        legacy_pkg_skills = data_dir / "packages" / "local" / "skills"
        legacy_manifest = data_dir / "manifest.json"
        legacy_pkg_manifest = data_dir / "packages" / "local" / "manifest.json"

        # Migrate skills from old shapes if the new directory looks empty
        skills_populated = any(skills_store_root.iterdir()) if skills_store_root.is_dir() else False
        if not skills_populated:
            for legacy_dir in (legacy_pkg_skills, legacy_shared):
                if legacy_dir.is_dir():
                    for item in legacy_dir.iterdir():
                        target = skills_store_root / item.name
                        if not target.exists():
                            shutil.move(str(item), str(target))
                    break  # Only migrate the first-populated legacy shape

            # Manifest migration
            if not (data_dir / "skills-manifest.json").exists():
                if legacy_pkg_manifest.is_file():
                    shutil.copy2(str(legacy_pkg_manifest), str(data_dir / "skills-manifest.json"))
                elif legacy_manifest.is_file():
                    shutil.copy2(str(legacy_manifest), str(data_dir / "skills-manifest.json"))

        # Agents migration
        agents_populated = any(agents_root.iterdir()) if agents_root.is_dir() else False
        if not agents_populated:
            legacy_agents_dir = data_dir / "packages" / "local" / "agents"
            if legacy_agents_dir.is_dir():
                for item in legacy_agents_dir.iterdir():
                    target = agents_root / item.name
                    if not target.exists():
                        shutil.move(str(item), str(target))


def build_backend_container(
    env: dict[str, str] | None = None,
    *,
    marketplace_catalog: MarketplaceCatalog | None = None,
    mcp_marketplace_catalog: McpMarketplaceCatalog | None = None,
    cli_marketplace_catalog: CliMarketplaceCatalog | None = None,
    source_fetcher: SourceFetchService | None = None,
    mcp_availability_probe: McpAvailabilityProbe | None = None,
) -> BackendContainer:
    active_env = dict(os.environ)
    if env is not None:
        active_env.update(env)

    paths = resolve_app_paths(active_env)
    app_home = resolve_context(active_env).home
    
    _migrate_legacy_layouts(paths.data_dir, paths.skills_store_root, paths.agents_root)

    support_store = HarnessSupportStore(paths.settings_path)
    harness_kernel = HarnessKernelService.from_environment(active_env, support_store=support_store)
    invalidation = InvalidationFanout()

    skills_store = SkillStore(
        paths.skills_store_root,
        manifest_path=paths.skills_store_manifest,
    )
    skills_read_models = SkillsReadModelService.from_kernel(store=skills_store, kernel=harness_kernel, data_dir=paths.data_dir)
    invalidation.register(skills_read_models)

    active_source_fetcher = source_fetcher or SourceFetchService()
    skills_queries = SkillsQueryService(skills_read_models, active_source_fetcher)
    skills_mutations = SkillsMutationService(skills_read_models, skills_queries, active_source_fetcher)
    settings_queries = SettingsQueryService(harness_kernel, paths)
    slash_targets = resolve_slash_targets(harness_kernel)
    slash_command_store = SlashCommandStore(
        SlashCommandStorePaths(
            root=paths.slash_command_store_root,
            commands_dir=paths.slash_command_commands_dir,
        )
    )
    slash_command_sync_state = SlashCommandSyncStateStore(paths.slash_command_sync_state_path)
    slash_command_path_policy = SlashCommandPathPolicy()
    migrate_legacy_slash_commands(
        command_store=slash_command_store,
        sync_state_store=slash_command_sync_state,
        context=harness_kernel.context,
        targets=slash_targets,
        path_policy=slash_command_path_policy,
    )

    def resolve_slash_snapshot():
        # Re-resolved per call so toggling a harness in Settings takes effect at once.
        return resolve_slash_targets(harness_kernel)

    slash_command_read_models = SlashCommandReadModelService(
        slash_command_store,
        slash_command_sync_state,
        resolve_slash_snapshot,
        slash_command_path_policy,
    )
    slash_command_queries = SlashCommandQueryService(slash_command_read_models)
    slash_command_mutations = SlashCommandMutationService(
        slash_command_store,
        slash_command_sync_state,
        slash_command_queries,
        slash_command_read_models,
        SlashCommandPlanner(slash_command_path_policy),
        resolve_slash_snapshot,
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
    mcp_availability_probe = mcp_availability_probe or McpAvailabilityProbe()
    mcp_availability_cache = {}
    mcp_queries = McpQueryService(
        mcp_read_models,
        planner=mcp_planner,
        enrichment=mcp_enrichment,
        marketplace_catalog=mcp_catalog,
        availability_probe=mcp_availability_probe,
        availability_cache=mcp_availability_cache,
    )
    mcp_mutations = McpMutationService(
        store=mcp_store,
        read_models=mcp_read_models,
        planner=mcp_planner,
        marketplace_catalog=mcp_catalog,
        enrichment=mcp_enrichment,
        availability_probe=mcp_availability_probe,
        availability_cache=mcp_availability_cache,
    )

    hooks_store = HookStore(paths.hooks_store_manifest)
    hooks_read_models = HooksReadModelService.from_kernel(store=hooks_store, kernel=harness_kernel)
    invalidation.register(hooks_read_models)
    hooks_queries = HooksQueryService(hooks_read_models)
    hooks_mutations = HooksMutationService(
        store=hooks_store,
        read_models=hooks_read_models,
    )

    permissions_store = PermissionStore(paths.permissions_store_manifest)
    permissions_read_models = PermissionsReadModelService.from_kernel(store=permissions_store, kernel=harness_kernel)
    invalidation.register(permissions_read_models)
    permissions_queries = PermissionsQueryService(permissions_read_models)
    permissions_mutations = PermissionsMutationService(
        store=permissions_store,
        read_models=permissions_read_models,
    )

    scaffold_service = ScaffoldService(paths)
    agents_store = AgentStore(paths.agents_root)

    def resolve_agents_snapshot():
        # Re-resolved per call so toggling a harness in Settings takes effect at once.
        targets = resolve_agent_targets(harness_kernel)
        return targets, {
            target.id: AgentHarnessAdapter(target, paths.agents_root) for target in targets
        }

    agents_inventory = AgentInventoryService(agents_store, resolve_agents_snapshot)
    agents_mutations = AgentMutationService(agents_store, resolve_agents_snapshot)

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
        slash_command_sync_state=slash_command_sync_state,
        slash_command_read_models=slash_command_read_models,
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
        hooks_store=hooks_store,
        hooks_read_models=hooks_read_models,
        hooks_queries=hooks_queries,
        hooks_mutations=hooks_mutations,
        permissions_store=permissions_store,
        permissions_read_models=permissions_read_models,
        permissions_queries=permissions_queries,
        permissions_mutations=permissions_mutations,
        scaffold_service=scaffold_service,
        agents_store=agents_store,
        agents_inventory=agents_inventory,
        agents_mutations=agents_mutations,
        app_home=app_home,
    )
