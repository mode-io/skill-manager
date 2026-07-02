from __future__ import annotations

import json
import re
import shutil
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
)

from .contracts import HookHarnessAdapter, HookHarnessScan, HookHarnessStatus, HookObservedEntry, BindingState
from .mappers import HookMapper, RawHookEntry, get_mapper
from .store import HookSpec


class FileBackedHooksAdapter(HookHarnessAdapter):
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
        self._install_probe = definition.install_probe
        self._path_env = context.env.get("PATH")
        self._file_format = profile.file_format
        self._write_subtree_path = profile.subtree_path
        self._env = context.env
        self._mapper: HookMapper = get_mapper(profile.codec)

    def status(self) -> HookHarnessStatus:
        installed = self._is_installed()
        config_present = self.config_path.is_file()
        return HookHarnessStatus(
            harness=self.harness,
            label=self.label,
            logo_key=self.logo_key,
            installed=installed,
            config_path=self.config_path,
            config_present=config_present,
            hooks_writable=True,
        )

    def scan(self, specs: tuple[HookSpec, ...]) -> HookHarnessScan:
        status = self.status()
        specs_by_id = {spec.id: spec for spec in specs}
        entries: list[HookObservedEntry] = []
        seen_ids: set[str] = set()
        scan_issue: str | None = None

        try:
            raw_entries = self._read_entries(specs) if status.config_present else ()
        except MutationError as error:
            raw_entries = ()
            scan_issue = str(error)

        for raw in raw_entries:
            seen_ids.add(raw.id)
            parsed_spec: HookSpec | None = None
            parse_issue: str | None = None
            try:
                parsed_spec = self._mapper.dict_to_spec(
                    raw.event,
                    raw.match,
                    raw.payload,
                )
            except Exception as error:  # noqa: BLE001
                parse_issue = str(error)

            managed_spec = specs_by_id.get(raw.id)
            if managed_spec is None:
                entries.append(
                    HookObservedEntry(
                        id=raw.id,
                        event=raw.event,
                        state="unmanaged",
                        raw_payload=dict(raw.payload),
                        parsed_spec=parsed_spec,
                        parse_issue=parse_issue,
                    )
                )
                continue

            if parse_issue is not None:
                entries.append(
                    HookObservedEntry(
                        id=raw.id,
                        event=raw.event,
                        state="drifted",
                        raw_payload=dict(raw.payload),
                        parsed_spec=parsed_spec,
                        drift_detail=parse_issue,
                        parse_issue=parse_issue,
                    )
                )
                continue

            is_repr, reason, caveat = self._mapper.representable(managed_spec)
            if not is_repr:
                entries.append(
                    HookObservedEntry(
                        id=raw.id,
                        event=raw.event,
                        state="unsupported",
                        raw_payload=dict(raw.payload),
                        parsed_spec=parsed_spec,
                        drift_detail=reason,
                        caveat=caveat,
                    )
                )
                continue

            expected = _normalize_payload(self._mapper.spec_to_dict(managed_spec))
            actual = _normalize_payload(dict(raw.payload))
            if expected == actual and managed_spec.event == raw.event and managed_spec.match == raw.match:
                entries.append(
                    HookObservedEntry(
                        id=raw.id,
                        event=raw.event,
                        state="managed",
                        raw_payload=dict(raw.payload),
                        parsed_spec=parsed_spec,
                        caveat=caveat,
                    )
                )
            else:
                drift_parts = []
                if managed_spec.event != raw.event:
                    drift_parts.append(f"event: expected={managed_spec.event}, actual={raw.event}")
                if managed_spec.match != raw.match:
                    drift_parts.append(f"match: expected={managed_spec.match}, actual={raw.match}")
                if expected != actual:
                    drift_parts.append(_drift_detail(expected, actual))
                entries.append(
                    HookObservedEntry(
                        id=raw.id,
                        event=raw.event,
                        state="drifted",
                        raw_payload=dict(raw.payload),
                        parsed_spec=parsed_spec,
                        drift_detail="; ".join(drift_parts) or "value mismatch",
                        caveat=caveat,
                    )
                )

        for spec in specs:
            if spec.id in seen_ids:
                continue
            is_repr, reason, caveat = self._mapper.representable(spec)
            if not is_repr:
                entries.append(
                    HookObservedEntry(
                        id=spec.id,
                        event=spec.event,
                        state="unsupported",
                        parsed_spec=spec,
                        drift_detail=reason,
                        caveat=caveat,
                    )
                )
            else:
                entries.append(
                    HookObservedEntry(
                        id=spec.id,
                        event=spec.event,
                        state="missing",
                        parsed_spec=spec,
                        caveat=caveat,
                    )
                )

        return HookHarnessScan(
            harness=self.harness,
            label=self.label,
            logo_key=self.logo_key,
            installed=status.installed,
            config_present=status.config_present,
            config_path=self.config_path,
            scan_issue=scan_issue,
            entries=tuple(entries),
        )

    def has_binding(self, id: str) -> bool:
        specs = ()
        try:
            from skill_manager.paths import resolve_app_paths
            from skill_manager.application.hooks.store import HookStore
            app_paths = resolve_app_paths(self._env)
            store = HookStore(app_paths.hooks_store_manifest)
            specs = store.list_managed()
        except Exception:
            pass
        return any(raw.id == id for raw in self._read_entries(specs))

    def enable_hook(self, spec: HookSpec) -> None:
        is_repr, reason, caveat = self._mapper.representable(spec)
        if not is_repr:
            raise MutationError(f"Hook not supported on {self.label}: {reason}", status=400)

        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        with file_lock(self._lock_path(self.config_path)):
            document = self._load_document(self.config_path)
            self._mapper.enable_hook(document, spec)
            atomic_write_text(self.config_path, self._dump_document(document))

    def disable_hook(self, id: str) -> None:
        if not self.config_path.is_file():
            return
        with file_lock(self._lock_path(self.config_path)):
            document = self._load_document(self.config_path)
            command = self._get_managed_command(id)
            self._mapper.disable_hook(document, id, command)
            atomic_write_text(self.config_path, self._dump_document(document))

    def invalidate(self) -> None:
        return None

    def _is_installed(self) -> bool:
        return shutil.which(self._install_probe, path=self._path_env) is not None

    def _lock_path(self, config_path: Path) -> Path:
        return config_path.with_suffix(config_path.suffix + ".lock")

    def _load_document(self, config_path: Path) -> dict[str, object]:
        if not config_path.is_file():
            return {}
        text = config_path.read_text(encoding="utf-8")
        if not text.strip():
            return {}
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
        return payload if isinstance(payload, dict) else {}

    def _dump_document(self, document: dict[str, object]) -> str:
        if self._file_format in {"json", "jsonc"}:
            return json.dumps(document, ensure_ascii=False, indent=2) + "\n"
        return tomli_w.dumps(document)

    def _read_entries(self, specs: tuple[HookSpec, ...] = ()) -> tuple[RawHookEntry, ...]:
        if not self.config_path.is_file():
            return ()
        document = self._load_document(self.config_path)
        return tuple(self._mapper.read_entries(document, specs))

    def _get_managed_command(self, id: str) -> str | None:
        try:
            from skill_manager.paths import resolve_app_paths
            from skill_manager.application.hooks.store import HookStore
            app_paths = resolve_app_paths(self._env)
            store = HookStore(app_paths.hooks_store_manifest)
            spec = store.get_managed(id)
            return spec.command if spec else None
        except Exception:
            return None


def build_hooks_adapters(
    kernel: HarnessKernelService,
) -> tuple[FileBackedHooksAdapter, ...]:
    return tuple(
        FileBackedHooksAdapter(
            definition=binding.definition,
            profile=binding.profile,
            context=kernel.context,
        )
        for binding in kernel.bindings_for_family("hooks")
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
    if key == "type" and value == "command":
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


__all__ = ["FileBackedHooksAdapter", "build_hooks_adapters"]
