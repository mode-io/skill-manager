from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from .adapters.config_backed import ConfigHarnessAdapter
from .adapters.filesystem_backed import FilesystemHarnessAdapter
from .adapters.openclaw import OpenClawCliClient, OpenClawConfigResolver, OpenClawHarnessAdapter
from .contracts import AdapterConfig, HarnessAdapter
from .path_resolver import ResolvedHarnessPaths


AdapterFactory = Callable[[dict[str, str], ResolvedHarnessPaths, AdapterConfig], HarnessAdapter]


@dataclass(frozen=True)
class HarnessDefinition:
    harness: str
    label: str
    logo_key: str | None
    adapter_factory: AdapterFactory

    def adapter_config(self) -> AdapterConfig:
        return AdapterConfig(
            harness=self.harness,
            label=self.label,
            logo_key=self.logo_key,
        )

    def create_adapter(
        self,
        env: dict[str, str],
        paths: ResolvedHarnessPaths,
    ) -> HarnessAdapter:
        return self.adapter_factory(env, paths, self.adapter_config())


def supported_harness_definitions() -> tuple[HarnessDefinition, ...]:
    return SUPPORTED_HARNESS_DEFINITIONS


def supported_harness_ids() -> tuple[str, ...]:
    return tuple(definition.harness for definition in SUPPORTED_HARNESS_DEFINITIONS)


def _filesystem_adapter(root_attr: str, global_attr: str) -> AdapterFactory:
    def factory(env: dict[str, str], paths: ResolvedHarnessPaths, config: AdapterConfig) -> HarnessAdapter:
        del env
        return FilesystemHarnessAdapter(
            config=config,
            managed_skills_root=getattr(paths, root_attr),
            global_skills_root=getattr(paths, global_attr),
        )

    return factory


def _config_adapter(root_attr: str, global_attr: str, builtins_attr: str) -> AdapterFactory:
    def factory(env: dict[str, str], paths: ResolvedHarnessPaths, config: AdapterConfig) -> HarnessAdapter:
        del env
        return ConfigHarnessAdapter(
            config=config,
            managed_skills_root=getattr(paths, root_attr),
            global_skills_root=getattr(paths, global_attr),
            builtins_path=getattr(paths, builtins_attr),
        )

    return factory


def _openclaw_adapter(env: dict[str, str], paths: ResolvedHarnessPaths, config: AdapterConfig) -> HarnessAdapter:
    del paths
    return OpenClawHarnessAdapter(
        config=config,
        resolver=OpenClawConfigResolver(env),
        cli_client=OpenClawCliClient(env),
    )


SUPPORTED_HARNESS_DEFINITIONS: tuple[HarnessDefinition, ...] = (
    HarnessDefinition(
        harness="codex",
        label="Codex",
        logo_key="codex",
        adapter_factory=_filesystem_adapter("codex_user_root", "codex_global_root"),
    ),
    HarnessDefinition(
        harness="claude",
        label="Claude",
        logo_key="claude",
        adapter_factory=_filesystem_adapter("claude_user_root", "claude_global_root"),
    ),
    HarnessDefinition(
        harness="cursor",
        label="Cursor",
        logo_key="cursor",
        adapter_factory=_filesystem_adapter("cursor_user_root", "cursor_global_root"),
    ),
    HarnessDefinition(
        harness="opencode",
        label="OpenCode",
        logo_key="opencode",
        adapter_factory=_config_adapter("opencode_user_root", "opencode_global_root", "opencode_builtins"),
    ),
    HarnessDefinition(
        harness="openclaw",
        label="OpenClaw",
        logo_key="openclaw",
        adapter_factory=_openclaw_adapter,
    ),
)
