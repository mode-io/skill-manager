from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ResolutionContext:
    env: dict[str, str]
    home: Path
    xdg_config_home: Path
    xdg_data_home: Path


@dataclass(frozen=True)
class DirectoryResolution:
    managed_root: Path
    global_root: Path | None


@dataclass(frozen=True)
class CatalogResolution:
    managed_root: Path
    global_root: Path | None
    builtins_path: Path | None


def resolve_context(env: dict[str, str] | None = None) -> ResolutionContext:
    active_env = dict(env or {})
    home = Path(active_env.get("HOME", str(Path.home())))
    return ResolutionContext(
        env=active_env,
        home=home,
        xdg_config_home=Path(active_env.get("XDG_CONFIG_HOME", home / ".config")),
        xdg_data_home=Path(active_env.get("XDG_DATA_HOME", home / ".local" / "share")),
    )


class DirectoryResolver:
    def __init__(
        self,
        context: ResolutionContext,
        *,
        managed_env: str,
        managed_default: Path,
        global_env: str,
    ) -> None:
        self._context = context
        self._managed_env = managed_env
        self._managed_default = managed_default
        self._global_env = global_env

    def resolve(self) -> DirectoryResolution:
        env = self._context.env
        return DirectoryResolution(
            managed_root=Path(env.get(self._managed_env, self._managed_default)),
            global_root=_optional_path(env.get(self._global_env)),
        )


class CatalogResolver:
    def __init__(
        self,
        context: ResolutionContext,
        *,
        managed_env: str,
        managed_default: Path,
        global_env: str,
        builtins_env: str,
        builtins_default: Path,
    ) -> None:
        self._context = context
        self._managed_env = managed_env
        self._managed_default = managed_default
        self._global_env = global_env
        self._builtins_env = builtins_env
        self._builtins_default = builtins_default

    def resolve(self) -> CatalogResolution:
        env = self._context.env
        return CatalogResolution(
            managed_root=Path(env.get(self._managed_env, self._managed_default)),
            global_root=_optional_path(env.get(self._global_env)),
            builtins_path=Path(env.get(self._builtins_env, self._builtins_default)),
        )


def _optional_path(value: str | None) -> Path | None:
    if not value:
        return None
    return Path(value)
