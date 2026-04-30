from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Literal, Mapping, TypeAlias

from .resolution import ResolutionContext


FamilyKey = Literal["skills", "mcp", "slash_commands"]
CommandFileRenderFormat = Literal["frontmatter_markdown", "cursor_plaintext"]
CommandFileScope = Literal["global", "project"]
PathResolver = Callable[[ResolutionContext], Path]
SubtreePath: TypeAlias = tuple[str, ...]
SubtreePathResolver = Callable[[ResolutionContext], SubtreePath]


@dataclass(frozen=True)
class FileTreeDiscoveryRoot:
    kind: str
    scope: str
    label: str
    path_resolver: PathResolver


@dataclass(frozen=True)
class FileTreeBindingProfile:
    shape: Literal["file-tree"] = "file-tree"
    managed_env: str | None = None
    managed_default: PathResolver | None = None
    discovery_roots: tuple[FileTreeDiscoveryRoot, ...] = ()

    def resolve_managed_root(self, context: ResolutionContext) -> Path:
        if self.managed_default is None:
            raise ValueError("file-tree binding profile is missing a managed_default resolver")
        if self.managed_env:
            override = context.env.get(self.managed_env)
            if override:
                return Path(override)
        return self.managed_default(context)


@dataclass(frozen=True)
class ConfigSubtreeBindingProfile:
    shape: Literal["config-subtree"] = "config-subtree"
    config_path_resolver: PathResolver | None = None
    discovery_config_path_resolvers: tuple[PathResolver, ...] = ()
    source_install_config_path_resolvers: tuple[PathResolver, ...] = ()
    file_format: Literal["json", "jsonc", "toml"] = "json"
    subtree_path: SubtreePath = ()
    discovery_subtree_path_resolvers: tuple[SubtreePathResolver, ...] = ()
    codec: str = "default"
    capability_probe: str | None = None
    capability_unavailable_reason: str | None = None

    def resolve_config_path(self, context: ResolutionContext) -> Path:
        if self.config_path_resolver is None:
            raise ValueError("config-subtree binding profile is missing a config_path_resolver")
        return self.config_path_resolver(context)

    def resolve_discovery_config_paths(self, context: ResolutionContext) -> tuple[Path, ...]:
        if self.config_path_resolver is None:
            raise ValueError("config-subtree binding profile is missing a config_path_resolver")
        paths = [self.config_path_resolver(context)]
        paths.extend(resolver(context) for resolver in self.discovery_config_path_resolvers)
        paths.extend(resolver(context) for resolver in self.source_install_config_path_resolvers)
        return tuple(_dedupe_paths(paths))

    def resolve_discovery_subtree_paths(self, context: ResolutionContext) -> tuple[SubtreePath, ...]:
        paths = [self.subtree_path]
        paths.extend(resolver(context) for resolver in self.discovery_subtree_path_resolvers)
        return tuple(_dedupe_subtree_paths(paths))


@dataclass(frozen=True)
class CommandFileBindingProfile:
    shape: Literal["command-file"] = "command-file"
    root_path_resolver: PathResolver | None = None
    output_dir_resolver: PathResolver | None = None
    invocation_prefix: str = "/"
    render_format: CommandFileRenderFormat = "frontmatter_markdown"
    scope: CommandFileScope = "global"
    docs_url: str = ""
    file_glob: str = "*.md"
    supports_frontmatter: bool = True
    support_note: str | None = None

    def resolve_root_path(self, context: ResolutionContext) -> Path:
        if self.root_path_resolver is None:
            raise ValueError("command-file binding profile is missing a root_path_resolver")
        return self.root_path_resolver(context)

    def resolve_output_dir(self, context: ResolutionContext) -> Path:
        if self.output_dir_resolver is None:
            raise ValueError("command-file binding profile is missing an output_dir_resolver")
        return self.output_dir_resolver(context)


def _dedupe_subtree_paths(paths: list[SubtreePath]) -> list[SubtreePath]:
    seen: set[SubtreePath] = set()
    result: list[SubtreePath] = []
    for path in paths:
        if not path or path in seen:
            continue
        seen.add(path)
        result.append(path)
    return result


def _dedupe_paths(paths: list[Path]) -> list[Path]:
    seen: set[Path] = set()
    result: list[Path] = []
    for path in paths:
        if path in seen:
            continue
        seen.add(path)
        result.append(path)
    return result


BindingProfile: TypeAlias = FileTreeBindingProfile | ConfigSubtreeBindingProfile | CommandFileBindingProfile


@dataclass(frozen=True)
class HarnessDefinition:
    harness: str
    label: str
    logo_key: str | None
    install_probe: str
    bindings: Mapping[FamilyKey, BindingProfile] = field(default_factory=dict)

    def supports_family(self, family: FamilyKey) -> bool:
        return family in self.bindings

    def binding_for(self, family: FamilyKey) -> BindingProfile | None:
        return self.bindings.get(family)


@dataclass(frozen=True)
class HarnessStatus:
    harness: str
    label: str
    logo_key: str | None
    installed: bool
    managed_location: Path | None = None


__all__ = [
    "BindingProfile",
    "CommandFileScope",
    "CommandFileBindingProfile",
    "CommandFileRenderFormat",
    "ConfigSubtreeBindingProfile",
    "FamilyKey",
    "FileTreeBindingProfile",
    "FileTreeDiscoveryRoot",
    "HarnessDefinition",
    "HarnessStatus",
    "PathResolver",
    "SubtreePath",
    "SubtreePathResolver",
]
