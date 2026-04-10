from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import subprocess
from threading import Lock
import time

from skill_manager.domain import HarnessScan, SkillObservation, SkillParseError, SourceDescriptor, find_skill_roots, parse_skill_package

from .contracts import HarnessDefinitionLike, HarnessDriver, HarnessLocation, HarnessManager, HarnessStatus
from .managers import SymlinkHarnessManager
from .resolution import ResolutionContext


@dataclass(frozen=True)
class OpenClawConfigState:
    home: Path
    config_path: Path
    config_exists: bool
    workspace_dir: Path
    managed_skills_root: Path
    extra_skill_dirs: tuple[Path, ...]


@dataclass(frozen=True)
class OpenClawCliSnapshot:
    workspace_dir: Path | None
    managed_skills_root: Path | None


@dataclass(frozen=True)
class _ResolvedOpenClawState:
    detected: bool
    config_path: Path
    workspace_dir: Path
    managed_skills_root: Path
    scan_roots: tuple[tuple[str, Path], ...]


@dataclass(frozen=True)
class _CachedState:
    state: _ResolvedOpenClawState
    captured_at: float


class OpenClawConfigResolver:
    def __init__(self, context: ResolutionContext) -> None:
        self.home = context.home
        self.config_path = Path(
            context.env.get("SKILL_MANAGER_OPENCLAW_CONFIG", self.home / ".openclaw" / "openclaw.json")
        )

    def resolve(self) -> OpenClawConfigState:
        workspace_dir = self.config_path.parent / "workspace"
        managed_skills_root = self.config_path.parent / "skills"
        extra_skill_dirs: tuple[Path, ...] = ()

        if self.config_path.is_file():
            try:
                payload = json.loads(self.config_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                pass
            else:
                workspace_value = _nested_string(payload, "agents", "defaults", "workspace") or _nested_string(
                    payload,
                    "agent",
                    "workspace",
                )
                if workspace_value:
                    workspace_dir = _resolve_config_path(self.config_path.parent, workspace_value)
                extra_skill_dirs = tuple(
                    _resolve_config_path(self.config_path.parent, value)
                    for value in _nested_strings(payload, "skills", "load", "extraDirs")
                )

        return OpenClawConfigState(
            home=self.home,
            config_path=self.config_path,
            config_exists=self.config_path.is_file(),
            workspace_dir=workspace_dir,
            managed_skills_root=managed_skills_root,
            extra_skill_dirs=extra_skill_dirs,
        )


class OpenClawCliClient:
    def __init__(self, context: ResolutionContext, *, timeout_seconds: float = 6.0) -> None:
        self.executable = context.env.get("SKILL_MANAGER_OPENCLAW_CLI", "openclaw").strip()
        self.timeout_seconds = timeout_seconds

    def list_skills(self) -> OpenClawCliSnapshot | None:
        if not self.executable:
            return None
        try:
            completed = subprocess.run(
                [self.executable, "skills", "list", "--json"],
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
                check=False,
            )
        except FileNotFoundError:
            return None
        except subprocess.TimeoutExpired:
            return None
        except OSError:
            return None

        if completed.returncode != 0:
            return None
        try:
            payload = json.loads(completed.stdout or "{}")
        except json.JSONDecodeError:
            return None

        return OpenClawCliSnapshot(
            workspace_dir=_optional_path(payload.get("workspaceDir")),
            managed_skills_root=_optional_path(payload.get("managedSkillsDir")),
        )


class OpenClawHarnessDriver(HarnessDriver):
    def __init__(
        self,
        *,
        definition: HarnessDefinitionLike,
        resolver: OpenClawConfigResolver,
        cli_client: OpenClawCliClient | None = None,
        cache_ttl_seconds: float = 15.0,
    ) -> None:
        self.harness = definition.harness
        self.label = definition.label
        self.logo_key = definition.logo_key
        self._resolver = resolver
        self._cli_client = cli_client
        self._cache_ttl_seconds = cache_ttl_seconds
        self._cached_state: _CachedState | None = None
        self._lock = Lock()

    def manager(self) -> HarnessManager | None:
        return SymlinkHarnessManager(self._resolve_state().managed_skills_root)

    def status(self) -> HarnessStatus:
        resolved = self._resolve_state()
        return HarnessStatus(
            harness=self.harness,
            label=self.label,
            logo_key=self.logo_key,
            detected=resolved.detected,
            locations=tuple(_locations_from_resolved_state(resolved)),
        )

    def scan(self) -> HarnessScan:
        resolved = self._resolve_state()
        observations: list[SkillObservation] = []

        for scope, root in resolved.scan_roots:
            if not root.exists():
                continue
            for skill_root in find_skill_roots(root):
                try:
                    package = parse_skill_package(
                        skill_root,
                        default_source=SourceDescriptor(
                            kind="harness-local",
                            locator=f"{self.harness}:{scope}:{skill_root.name}",
                        ),
                    )
                except SkillParseError:
                    continue
                observations.append(
                    SkillObservation(
                        harness=self.harness,
                        label=self.label,
                        scope=scope,
                        package=package,
                    )
                )

        return HarnessScan(
            harness=self.harness,
            label=self.label,
            logo_key=self.logo_key,
            detected=resolved.detected or bool(observations),
            manageable=self.manager() is not None,
            skills=tuple(observations),
        )

    def invalidate(self) -> None:
        with self._lock:
            self._cached_state = None

    def _resolve_state(self) -> _ResolvedOpenClawState:
        with self._lock:
            cached = self._cached_state
            if cached is not None and (time.monotonic() - cached.captured_at) < self._cache_ttl_seconds:
                return cached.state

        config_state = self._resolver.resolve()
        cli_snapshot = self._cli_client.list_skills() if self._cli_client is not None else None
        workspace_dir = cli_snapshot.workspace_dir or config_state.workspace_dir
        managed_skills_root = cli_snapshot.managed_skills_root or config_state.managed_skills_root
        scan_roots = _dedupe_roots(
            (
                ("managed", managed_skills_root),
                ("home-agents", config_state.home / ".agents" / "skills"),
                ("workspace-agents", workspace_dir / ".agents" / "skills"),
                ("workspace", workspace_dir / "skills"),
                *((f"extra-{index}", path) for index, path in enumerate(config_state.extra_skill_dirs, start=1)),
            )
        )
        detected = config_state.config_exists or cli_snapshot is not None or any(root.exists() for _, root in scan_roots)
        state = _ResolvedOpenClawState(
            detected=detected,
            config_path=config_state.config_path,
            workspace_dir=workspace_dir,
            managed_skills_root=managed_skills_root,
            scan_roots=scan_roots,
        )
        with self._lock:
            self._cached_state = _CachedState(state=state, captured_at=time.monotonic())
        return state


def _dedupe_roots(roots: tuple[tuple[str, Path], ...]) -> tuple[tuple[str, Path], ...]:
    selected: list[tuple[str, Path]] = []
    seen: set[Path] = set()
    for scope, root in roots:
        resolved = root.resolve(strict=False)
        if resolved in seen:
            continue
        seen.add(resolved)
        selected.append((scope, root))
    return tuple(selected)


def _nested_string(payload: object, *keys: str) -> str | None:
    current: object = payload
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current if isinstance(current, str) and current else None


def _nested_strings(payload: object, *keys: str) -> tuple[str, ...]:
    current: object = payload
    for key in keys:
        if not isinstance(current, dict):
            return ()
        current = current.get(key)
    if not isinstance(current, list):
        return ()
    return tuple(item for item in current if isinstance(item, str) and item)


def _optional_path(value: object) -> Path | None:
    if not isinstance(value, str) or not value:
        return None
    return Path(value)


def _resolve_config_path(base_dir: Path, raw_path: str) -> Path:
    candidate = Path(raw_path).expanduser()
    if candidate.is_absolute():
        return candidate
    return (base_dir / candidate).resolve(strict=False)


def _locations_from_resolved_state(resolved: _ResolvedOpenClawState) -> list[HarnessLocation]:
    return [
        HarnessLocation(kind="config", label="Config", path=resolved.config_path, present=resolved.config_path.exists()),
        HarnessLocation(kind="workspace", label="Workspace", path=resolved.workspace_dir, present=resolved.workspace_dir.exists()),
        HarnessLocation(
            kind="managed-root",
            label="Managed skills root",
            path=resolved.managed_skills_root,
            present=resolved.managed_skills_root.exists(),
        ),
        *[
            HarnessLocation(
                kind="search-root",
                label=_openclaw_location_label(scope),
                path=root,
                present=root.exists(),
            )
            for scope, root in resolved.scan_roots
            if scope != "managed"
        ],
    ]


def _openclaw_location_label(kind: str) -> str:
    if kind == "home-agents":
        return "Home .agents skills"
    if kind == "workspace-agents":
        return "Workspace .agents skills"
    if kind == "workspace":
        return "Workspace skills"
    return "Additional search root"
