from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from .contracts import HarnessDefinitionLike, HarnessDiscoveryRoot, HarnessDriver
from .drivers import GlobalHarnessDriver
from .resolution import ResolutionContext


DriverFactory = Callable[[ResolutionContext, "HarnessDefinition"], HarnessDriver]
PathResolver = Callable[[ResolutionContext], Path]


@dataclass(frozen=True)
class DiscoveryRootDefinition:
    kind: str
    scope: str
    label: str
    path_resolver: PathResolver


@dataclass(frozen=True)
class HarnessDefinition(HarnessDefinitionLike):
    harness: str
    label: str
    logo_key: str | None
    install_probe: str
    managed_env: str | None
    managed_default: PathResolver
    driver_factory: DriverFactory
    discovery_roots: tuple[DiscoveryRootDefinition, ...] = ()
    builtins_env: str | None = None
    builtins_default: PathResolver | None = None

    def create_driver(
        self,
        context: ResolutionContext,
    ) -> HarnessDriver:
        return self.driver_factory(context, self)


def supported_harness_definitions() -> tuple[HarnessDefinition, ...]:
    return SUPPORTED_HARNESS_DEFINITIONS


def supported_harness_ids() -> tuple[str, ...]:
    return tuple(definition.harness for definition in SUPPORTED_HARNESS_DEFINITIONS)


def _global_driver() -> DriverFactory:
    def factory(context: ResolutionContext, definition: HarnessDefinition) -> HarnessDriver:
        env = context.env
        managed_root = Path(env.get(definition.managed_env, definition.managed_default(context))) if definition.managed_env else definition.managed_default(context)
        discovery_roots: list[HarnessDiscoveryRoot] = [
            HarnessDiscoveryRoot(
                kind="managed-root",
                scope="canonical",
                label="Managed skills root",
                path=managed_root,
                writable=True,
            )
        ]
        for root in definition.discovery_roots:
            discovery_roots.append(
                HarnessDiscoveryRoot(
                    kind=root.kind,
                    scope=root.scope,
                    label=root.label,
                    path=root.path_resolver(context),
                    writable=False,
                )
            )
        builtins_path = None
        if definition.builtins_default is not None:
            if definition.builtins_env:
                builtins_path = Path(env.get(definition.builtins_env, definition.builtins_default(context)))
            else:
                builtins_path = definition.builtins_default(context)
        return GlobalHarnessDriver(
            definition=definition,
            install_probe=definition.install_probe,
            path_env=env.get("PATH"),
            discovery_roots=tuple(discovery_roots),
            builtins_path=builtins_path,
        )

    return factory


SUPPORTED_HARNESS_DEFINITIONS: tuple[HarnessDefinition, ...] = (
    HarnessDefinition(
        harness="codex",
        label="Codex",
        logo_key="codex",
        install_probe="codex",
        managed_env="SKILL_MANAGER_CODEX_ROOT",
        managed_default=lambda context: context.home / ".agents" / "skills",
        discovery_roots=(
            DiscoveryRootDefinition(
                kind="admin-root",
                scope="admin",
                label="Admin skills root",
                path_resolver=lambda _context: Path("/etc/codex/skills"),
            ),
            DiscoveryRootDefinition(
                kind="legacy-root",
                scope="legacy",
                label="Legacy import root",
                path_resolver=lambda context: context.home / ".codex" / "skills",
            ),
        ),
        driver_factory=_global_driver(),
    ),
    HarnessDefinition(
        harness="claude",
        label="Claude",
        logo_key="claude",
        install_probe="claude",
        managed_env="SKILL_MANAGER_CLAUDE_ROOT",
        managed_default=lambda context: context.home / ".claude" / "skills",
        driver_factory=_global_driver(),
    ),
    HarnessDefinition(
        harness="cursor",
        label="Cursor",
        logo_key="cursor",
        install_probe="cursor-agent",
        managed_env="SKILL_MANAGER_CURSOR_ROOT",
        managed_default=lambda context: context.home / ".cursor" / "skills",
        driver_factory=_global_driver(),
    ),
    HarnessDefinition(
        harness="opencode",
        label="OpenCode",
        logo_key="opencode",
        install_probe="opencode",
        managed_env="SKILL_MANAGER_OPENCODE_ROOT",
        managed_default=lambda context: context.xdg_config_home / "opencode" / "skills",
        discovery_roots=(
            DiscoveryRootDefinition(
                kind="compat-root",
                scope="claude-compat",
                label="Claude compatibility root",
                path_resolver=lambda context: context.home / ".claude" / "skills",
            ),
            DiscoveryRootDefinition(
                kind="compat-root",
                scope="agents-compat",
                label="Agents compatibility root",
                path_resolver=lambda context: context.home / ".agents" / "skills",
            ),
        ),
        builtins_env="SKILL_MANAGER_OPENCODE_BUILTINS",
        builtins_default=lambda context: context.xdg_config_home / "opencode" / "builtins.json",
        driver_factory=_global_driver(),
    ),
    HarnessDefinition(
        harness="openclaw",
        label="OpenClaw",
        logo_key="openclaw",
        install_probe="openclaw",
        managed_env=None,
        managed_default=lambda context: context.home / ".openclaw" / "skills",
        discovery_roots=(
            DiscoveryRootDefinition(
                kind="personal-root",
                scope="personal-agent",
                label="Personal agent skills root",
                path_resolver=lambda context: context.home / ".agents" / "skills",
            ),
        ),
        driver_factory=_global_driver(),
    ),
)
