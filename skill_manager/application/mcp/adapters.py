from __future__ import annotations

import json
import re
import shutil
import subprocess
import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

import tomli_w

from skill_manager.errors import MutationError
from skill_manager.atomic_files import atomic_write_text, file_lock
from skill_manager.harness import (
    ConfigSubtreeBindingProfile,
    HarnessDefinition,
    HarnessKernelService,
    ResolutionContext,
    SubtreePath,
)

from .contracts import McpHarnessAdapter, McpHarnessScan, McpHarnessStatus, McpObservedEntry
from .mappers import TransportMapper, get_mapper
from .store import McpServerSpec, McpSource


@dataclass(frozen=True)
class _RawEntry:
    name: str
    payload: dict[str, object]
    config_path: Path
    subtree_path: SubtreePath


class FileBackedMcpAdapter(McpHarnessAdapter):
    def __init__(
        self,
        *,
        definition: HarnessDefinition,
        profile: ConfigSubtreeBindingProfile,
        context: ResolutionContext,
    ) -> None:
        self.harness = definition.harness
        self.label = definition.label
        self.logo_key = definition.logo_key
        self.config_path = profile.resolve_config_path(context)
        self._discovery_config_paths = profile.resolve_discovery_config_paths(context)
        self._install_probe = definition.install_probe
        self._path_env = context.env.get("PATH")
        self._file_format = profile.file_format
        self._write_subtree_path = profile.subtree_path
        self._read_subtree_paths = profile.resolve_discovery_subtree_paths(context)
        self._mapper: TransportMapper = get_mapper(profile.codec)
        self._capability_probe = profile.capability_probe
        self._capability_unavailable_reason = profile.capability_unavailable_reason

    def status(self) -> McpHarnessStatus:
        installed = self._is_installed()
        config_present = any(path.is_file() for path in self._discovery_config_paths)
        mcp_writable, unavailable_reason = self._mcp_write_capability(installed=installed)
        return McpHarnessStatus(
            harness=self.harness,
            label=self.label,
            logo_key=self.logo_key,
            installed=installed,
            config_path=self.config_path,
            config_present=config_present,
            mcp_writable=mcp_writable,
            mcp_unavailable_reason=unavailable_reason,
        )

    def scan(self, specs: tuple[McpServerSpec, ...]) -> McpHarnessScan:
        status = self.status()
        specs_by_name = {spec.name: spec for spec in specs}
        entries: list[McpObservedEntry] = []
        seen_names: set[str] = set()
        scan_issue: str | None = None

        try:
            raw_entries = self._read_entries() if status.config_present else ()
        except MutationError as error:
            raw_entries = ()
            scan_issue = str(error)
        for raw in raw_entries:
            seen_names.add(raw.name)
            parsed_spec: McpServerSpec | None = None
            parse_issue: str | None = None
            try:
                parsed_spec = self._mapper.dict_to_spec(
                    raw.name,
                    raw.payload,
                    source=McpSource.adopted(self.harness, raw.name),
                )
            except Exception as error:  # noqa: BLE001
                parse_issue = str(error)

            managed_spec = specs_by_name.get(raw.name)
            if managed_spec is None:
                entries.append(
                    McpObservedEntry(
                        name=raw.name,
                        state="unmanaged",
                        raw_payload=dict(raw.payload),
                        parsed_spec=parsed_spec,
                        parse_issue=parse_issue,
                    )
                )
                continue

            if parse_issue is not None:
                entries.append(
                    McpObservedEntry(
                        name=raw.name,
                        state="drifted",
                        raw_payload=dict(raw.payload),
                        parsed_spec=parsed_spec,
                        drift_detail=parse_issue,
                        parse_issue=parse_issue,
                    )
                )
                continue

            expected = _normalize_payload(self._mapper.spec_to_dict(managed_spec))
            actual = _normalize_payload(dict(raw.payload))
            if expected == actual:
                entries.append(
                    McpObservedEntry(
                        name=raw.name,
                        state="managed",
                        raw_payload=dict(raw.payload),
                        parsed_spec=parsed_spec,
                    )
                )
            else:
                entries.append(
                    McpObservedEntry(
                        name=raw.name,
                        state="drifted",
                        raw_payload=dict(raw.payload),
                        parsed_spec=parsed_spec,
                        drift_detail=_drift_detail(expected, actual),
                    )
                )

        for spec in specs:
            if spec.name in seen_names:
                continue
            entries.append(
                McpObservedEntry(
                    name=spec.name,
                    state="missing",
                    parsed_spec=spec,
                )
            )

        return McpHarnessScan(
            harness=self.harness,
            label=self.label,
            logo_key=self.logo_key,
            installed=status.installed,
            config_present=status.config_present,
            config_path=self.config_path,
            mcp_writable=status.mcp_writable,
            mcp_unavailable_reason=status.mcp_unavailable_reason,
            scan_issue=scan_issue,
            entries=tuple(entries),
        )

    def has_binding(self, name: str) -> bool:
        return any(raw.name == name for raw in self._read_entries())

    def enable_server(self, spec: McpServerSpec) -> None:
        self._require_mcp_writable()
        with file_lock(self._lock_path(self.config_path)):
            document = self._load_document(self.config_path)
            subtree = dict(self._read_subtree(document, self._write_subtree_path))
            subtree[spec.name] = self._mapper.spec_to_dict(spec)
            self._write_subtree(document, subtree, self._write_subtree_path)
            for subtree_path in self._read_subtree_paths:
                if subtree_path != self._write_subtree_path:
                    self._remove_from_subtree(document, subtree_path, spec.name)
            atomic_write_text(self.config_path, self._dump_document(document))
        self._remove_from_noncanonical_config_paths(spec.name)

    def disable_server(self, name: str) -> None:
        for config_path in self._discovery_config_paths:
            if not config_path.is_file():
                continue
            with file_lock(self._lock_path(config_path)):
                document = self._load_document(config_path)
                removed = False
                for subtree_path in self._read_subtree_paths:
                    removed = self._remove_from_subtree(document, subtree_path, name) or removed
                if not removed:
                    continue
                atomic_write_text(config_path, self._dump_document(document))

    def _remove_from_noncanonical_config_paths(self, name: str) -> None:
        for config_path in self._discovery_config_paths:
            if config_path == self.config_path or not config_path.is_file():
                continue
            with file_lock(self._lock_path(config_path)):
                document = self._load_document(config_path)
                removed = False
                for subtree_path in self._read_subtree_paths:
                    removed = self._remove_from_subtree(document, subtree_path, name) or removed
                if removed:
                    atomic_write_text(config_path, self._dump_document(document))

    def _require_mcp_writable(self) -> None:
        status = self.status()
        if status.mcp_writable:
            return
        reason = status.mcp_unavailable_reason or f"{self.label} MCP config is not writable"
        raise MutationError(reason, status=400)

    def _mcp_write_capability(self, *, installed: bool) -> tuple[bool, str | None]:
        if self._capability_probe is None:
            return True, None
        if self._capability_probe == "openclaw-mcp-command":
            executable = shutil.which(self._install_probe, path=self._path_env)
            reason = self._capability_unavailable_reason or f"{self.label} MCP support is unavailable"
            if executable is None:
                return False, reason
            try:
                result = subprocess.run(
                    [executable, "mcp", "--help"],
                    text=True,
                    capture_output=True,
                    timeout=2.0,
                    check=False,
                )
            except (OSError, subprocess.TimeoutExpired):
                return False, reason
            return (result.returncode == 0, None if result.returncode == 0 else reason)
        reason = self._capability_unavailable_reason or f"{self.label} MCP support is unavailable"
        return (installed, None if installed else reason)

    @staticmethod
    def _lock_path(config_path: Path) -> Path:
        return config_path.with_suffix(config_path.suffix + ".lock")

    def _is_installed(self) -> bool:
        return shutil.which(self._install_probe, path=self._path_env) is not None

    def _read_entries(self) -> tuple[_RawEntry, ...]:
        entries: list[_RawEntry] = []
        seen_names: set[str] = set()
        for config_path in self._discovery_config_paths:
            if not config_path.is_file():
                continue
            document = self._load_document(config_path)
            for subtree_path in self._read_subtree_paths:
                subtree = self._read_subtree(document, subtree_path)
                for name, value in subtree.items():
                    if name in seen_names or not isinstance(value, dict):
                        continue
                    seen_names.add(name)
                    entries.append(
                        _RawEntry(
                            name=name,
                            payload=dict(value),
                            config_path=config_path,
                            subtree_path=subtree_path,
                        )
                    )
        return tuple(entries)

    def invalidate(self) -> None:
        return None

    def _load_document(self, config_path: Path) -> dict[str, object]:
        if not config_path.is_file():
            return {}
        text = config_path.read_text(encoding="utf-8")
        if self._file_format in {"json", "jsonc"}:
            try:
                payload = json.loads(_strip_jsonc(text) if self._file_format == "jsonc" else text)
            except json.JSONDecodeError as error:
                raise MutationError(
                    f"{self.harness} config file is not valid {self._file_format.upper()}: {error}",
                    status=409,
                ) from error
            return payload if isinstance(payload, dict) else {}
        try:
            payload = tomllib.loads(text)
        except tomllib.TOMLDecodeError as error:
            raise MutationError(
                f"{self.harness} config file is not valid TOML: {error}",
                status=409,
            ) from error
        return payload

    def _dump_document(self, document: dict[str, object]) -> str:
        if self._file_format in {"json", "jsonc"}:
            return json.dumps(document, ensure_ascii=False, indent=2) + "\n"
        return tomli_w.dumps(document)

    def _read_subtree(
        self,
        document: Mapping[str, object],
        subtree_path: SubtreePath,
    ) -> Mapping[str, object]:
        cursor: object = document
        for segment in subtree_path:
            if not isinstance(cursor, Mapping):
                return {}
            cursor = cursor.get(segment, {})
        if isinstance(cursor, Mapping):
            return cursor
        return {}

    def _write_subtree(
        self,
        document: dict[str, object],
        subtree: dict[str, object],
        subtree_path: SubtreePath,
    ) -> None:
        cursor: dict[str, object] = document
        for segment in subtree_path[:-1]:
            existing = cursor.get(segment)
            if not isinstance(existing, dict):
                existing = {}
                cursor[segment] = existing
            cursor = existing  # type: ignore[assignment]
        leaf_key = subtree_path[-1]
        if subtree:
            cursor[leaf_key] = subtree
        else:
            cursor.pop(leaf_key, None)

    def _remove_from_subtree(
        self,
        document: dict[str, object],
        subtree_path: SubtreePath,
        name: str,
    ) -> bool:
        cursor: dict[str, object] = document
        for segment in subtree_path[:-1]:
            existing = cursor.get(segment)
            if not isinstance(existing, dict):
                return False
            cursor = existing
        leaf_key = subtree_path[-1]
        subtree = cursor.get(leaf_key)
        if not isinstance(subtree, dict) or name not in subtree:
            return False
        del subtree[name]
        if not subtree:
            cursor.pop(leaf_key, None)
        return True


def build_mcp_adapters(
    kernel: HarnessKernelService,
) -> tuple[FileBackedMcpAdapter, ...]:
    return tuple(
        FileBackedMcpAdapter(
            definition=binding.definition,
            profile=binding.profile,
            context=kernel.context,
        )
        for binding in kernel.bindings_for_family("mcp")
        if isinstance(binding.profile, ConfigSubtreeBindingProfile)
    )


def _normalize_payload(value: object) -> object:
    if isinstance(value, dict):
        normalized = {
            key: _normalize_payload(item)
            for key, item in value.items()
            if not _is_semantic_default(key, item)
        }
        return {key: normalized[key] for key in sorted(normalized)}
    if isinstance(value, list):
        return [_normalize_payload(item) for item in value]
    return value


def _is_semantic_default(key: str, value: object) -> bool:
    if key == "enabled" and value is True:
        return True
    if key == "transport" and value == "stdio":
        return True
    if key in {"headers", "env", "environment", "http_headers"} and value == {}:
        return True
    return False


def _strip_jsonc(text: str) -> str:
    without_block = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    without_line = re.sub(r"(^|[^:])//.*$", r"\1", without_block, flags=re.MULTILINE)
    return re.sub(r",(\s*[}\]])", r"\1", without_line)


def _drift_detail(expected: object, actual: object) -> str:
    if not isinstance(expected, dict) or not isinstance(actual, dict):
        return "value mismatch"
    missing = sorted(set(expected) - set(actual))
    extra = sorted(set(actual) - set(expected))
    changed = sorted(
        key for key in set(expected) & set(actual) if expected[key] != actual[key]
    )
    parts: list[str] = []
    if missing:
        parts.append(f"missing={','.join(missing)}")
    if extra:
        parts.append(f"extra={','.join(extra)}")
    if changed:
        parts.append(f"changed={','.join(changed)}")
    return "; ".join(parts) or "value mismatch"


__all__ = ["FileBackedMcpAdapter", "build_mcp_adapters"]
