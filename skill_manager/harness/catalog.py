from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from .contracts import HarnessDefinitionLike, HarnessDriver
from .drivers import CatalogHarnessDriver, FilesystemHarnessDriver
from .openclaw import OpenClawCliClient, OpenClawConfigResolver, OpenClawHarnessDriver
from .resolution import CatalogResolver, DirectoryResolver, ResolutionContext


DriverFactory = Callable[[ResolutionContext, "HarnessDefinition"], HarnessDriver]


@dataclass(frozen=True)
class HarnessDefinition(HarnessDefinitionLike):
    harness: str
    label: str
    logo_key: str | None
    driver_factory: DriverFactory

    def create_driver(
        self,
        context: ResolutionContext,
    ) -> HarnessDriver:
        return self.driver_factory(context, self)


def supported_harness_definitions() -> tuple[HarnessDefinition, ...]:
    return SUPPORTED_HARNESS_DEFINITIONS


def supported_harness_ids() -> tuple[str, ...]:
    return tuple(definition.harness for definition in SUPPORTED_HARNESS_DEFINITIONS)


def _filesystem_driver(*, managed_env: str, managed_default: Callable[[ResolutionContext], Path], global_env: str) -> DriverFactory:
    def factory(context: ResolutionContext, definition: HarnessDefinition) -> HarnessDriver:
        return FilesystemHarnessDriver(
            definition=definition,
            resolver=DirectoryResolver(
                context,
                managed_env=managed_env,
                managed_default=managed_default(context),
                global_env=global_env,
            ),
        )

    return factory


def _catalog_driver(
    *,
    managed_env: str,
    managed_default: Callable[[ResolutionContext], Path],
    global_env: str,
    builtins_env: str,
    builtins_default: Callable[[ResolutionContext], Path],
) -> DriverFactory:
    def factory(context: ResolutionContext, definition: HarnessDefinition) -> HarnessDriver:
        return CatalogHarnessDriver(
            definition=definition,
            resolver=CatalogResolver(
                context,
                managed_env=managed_env,
                managed_default=managed_default(context),
                global_env=global_env,
                builtins_env=builtins_env,
                builtins_default=builtins_default(context),
            ),
        )

    return factory


def _openclaw_driver(context: ResolutionContext, definition: HarnessDefinition) -> HarnessDriver:
    return OpenClawHarnessDriver(
        definition=definition,
        resolver=OpenClawConfigResolver(context),
        cli_client=OpenClawCliClient(context),
    )


SUPPORTED_HARNESS_DEFINITIONS: tuple[HarnessDefinition, ...] = (
    HarnessDefinition(
        harness="codex",
        label="Codex",
        logo_key="codex",
        driver_factory=_filesystem_driver(
            managed_env="SKILL_MANAGER_CODEX_ROOT",
            managed_default=lambda context: context.home / ".codex" / "skills",
            global_env="SKILL_MANAGER_CODEX_GLOBAL_ROOT",
        ),
    ),
    HarnessDefinition(
        harness="claude",
        label="Claude",
        logo_key="claude",
        driver_factory=_filesystem_driver(
            managed_env="SKILL_MANAGER_CLAUDE_ROOT",
            managed_default=lambda context: context.home / ".claude" / "skills",
            global_env="SKILL_MANAGER_CLAUDE_GLOBAL_ROOT",
        ),
    ),
    HarnessDefinition(
        harness="cursor",
        label="Cursor",
        logo_key="cursor",
        driver_factory=_filesystem_driver(
            managed_env="SKILL_MANAGER_CURSOR_ROOT",
            managed_default=lambda context: context.home / ".cursor" / "skills",
            global_env="SKILL_MANAGER_CURSOR_GLOBAL_ROOT",
        ),
    ),
    HarnessDefinition(
        harness="opencode",
        label="OpenCode",
        logo_key="opencode",
        driver_factory=_catalog_driver(
            managed_env="SKILL_MANAGER_OPENCODE_ROOT",
            managed_default=lambda context: context.xdg_config_home / "opencode" / "skills",
            global_env="SKILL_MANAGER_OPENCODE_GLOBAL_ROOT",
            builtins_env="SKILL_MANAGER_OPENCODE_BUILTINS",
            builtins_default=lambda context: context.xdg_config_home / "opencode" / "builtins.json",
        ),
    ),
    HarnessDefinition(
        harness="openclaw",
        label="OpenClaw",
        logo_key="openclaw",
        driver_factory=_openclaw_driver,
    ),
)
