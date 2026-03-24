from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from skill_manager.domain import HarnessScan, SourceDescriptor, StoreScan, stable_id


DisplayStatus = Literal["Managed", "Found locally", "Custom", "Built-in"]
EntryKind = Literal["managed", "found", "builtin"]


@dataclass(frozen=True)
class InventoryColumn:
    harness: str
    label: str

    def to_dict(self) -> dict[str, str]:
        return {"harness": self.harness, "label": self.label}


@dataclass(frozen=True)
class InventorySighting:
    kind: Literal["shared", "harness", "builtin"]
    harness: str | None
    label: str
    scope: str | None
    path: Path | None
    revision: str | None
    source: SourceDescriptor
    detail: str = ""

    def to_dict(self) -> dict[str, str | None]:
        return {
            "kind": self.kind,
            "harness": self.harness,
            "label": self.label,
            "scope": self.scope,
            "path": str(self.path) if self.path is not None else None,
            "revision": self.revision,
            "sourceKind": self.source.kind,
            "sourceLocator": self.source.locator,
            "detail": self.detail or None,
        }


@dataclass
class InventoryEntry:
    skill_ref: str
    name: str
    description: str
    kind: EntryKind
    source: SourceDescriptor
    source_label: str
    current_revision: str | None = None
    recorded_revision: str | None = None
    package_dir: str | None = None
    package_path: Path | None = None
    sightings: list[InventorySighting] = field(default_factory=list)

    @property
    def is_custom(self) -> bool:
        return (
            self.kind == "managed"
            and self.recorded_revision is not None
            and self.current_revision is not None
            and self.recorded_revision != self.current_revision
        )

    @property
    def display_status(self) -> DisplayStatus:
        if self.kind == "builtin":
            return "Built-in"
        if self.kind == "found":
            return "Found locally"
        if self.is_custom:
            return "Custom"
        return "Managed"

    @property
    def primary_action(self) -> dict[str, str]:
        if self.kind == "found":
            return {"kind": "manage", "label": "Bring under management"}
        return {"kind": "open", "label": "Open"}

    @property
    def attention_message(self) -> str | None:
        if self.is_custom:
            return "Modified locally; source updates are disabled."
        if self.kind == "found" and len(self._harness_presence()) > 1:
            return f"Found locally in {len(self._harness_presence())} tools."
        return None

    @property
    def can_update(self) -> bool:
        return self.kind == "managed" and not self.is_custom and self.source.is_source_backed

    @property
    def can_manage(self) -> bool:
        return self.kind == "found"

    @property
    def can_toggle(self) -> bool:
        return self.kind == "managed"

    def add_sighting(self, sighting: InventorySighting) -> None:
        self.sightings.append(sighting)

    def has_harness(self, harness: str) -> bool:
        return any(sighting.harness == harness for sighting in self.sightings if sighting.harness is not None)

    def row_dict(self, columns: tuple[InventoryColumn, ...]) -> dict[str, object]:
        return {
            "skillRef": self.skill_ref,
            "name": self.name,
            "description": self.description,
            "displayStatus": self.display_status,
            "attentionMessage": self.attention_message,
            "primaryAction": self.primary_action,
            "isBuiltin": self.kind == "builtin",
            "cells": [self._cell_dict(column) for column in columns],
        }

    def detail_dict(
        self,
        columns: tuple[InventoryColumn, ...],
        *,
        update_available: bool | None,
    ) -> dict[str, object]:
        status_message = {
            "Managed": "Managed in the shared store and available for per-tool enable or disable.",
            "Found locally": "Detected in local tool folders and not yet managed by skill-manager.",
            "Custom": "Managed in the shared store, but modified locally. Source updates are disabled.",
            "Built-in": "Provided by the tool and not managed by skill-manager.",
        }[self.display_status]

        return {
            "skillRef": self.skill_ref,
            "name": self.name,
            "description": self.description,
            "displayStatus": self.display_status,
            "statusMessage": status_message,
            "attentionMessage": self.attention_message,
            "primaryAction": self.primary_action,
            "source": {
                "kind": self.source.kind,
                "label": self.source_label,
                "locator": self.source.locator,
            },
            "actions": {
                "canManage": self.can_manage,
                "canToggle": self.can_toggle,
                "canUpdate": self.can_update,
                "updateAvailable": update_available,
            },
            "harnesses": [self._detail_harness_dict(column) for column in columns],
            "locations": [sighting.to_dict() for sighting in self._sorted_sightings()],
            "advanced": {
                "packageDir": self.package_dir,
                "packagePath": str(self.package_path) if self.package_path is not None else None,
                "currentRevision": self.current_revision,
                "recordedRevision": self.recorded_revision,
                "sourceKind": self.source.kind,
                "sourceLocator": self.source.locator,
            },
        }

    def _detail_harness_dict(self, column: InventoryColumn) -> dict[str, object]:
        state = self._cell_state(column.harness)
        matching = [s for s in self._sorted_sightings() if s.harness == column.harness]
        return {
            "harness": column.harness,
            "label": column.label,
            "state": state,
            "scopes": [s.scope for s in matching if s.scope],
            "paths": [str(s.path) for s in matching if s.path is not None],
        }

    def _cell_dict(self, column: InventoryColumn) -> dict[str, object]:
        state = self._cell_state(column.harness)
        return {
            "harness": column.harness,
            "label": column.label,
            "state": state,
            "interactive": state in {"enabled", "disabled"},
        }

    def _cell_state(self, harness: str) -> str:
        if self.kind == "builtin":
            return "builtin" if any(s.harness == harness for s in self.sightings) else "empty"
        if self.kind == "found":
            return "found" if any(s.harness == harness for s in self.sightings) else "empty"
        return "enabled" if any(s.harness == harness for s in self.sightings if s.kind == "harness") else "disabled"

    def _harness_presence(self) -> set[str]:
        return {s.harness for s in self.sightings if s.harness is not None}

    def _sorted_sightings(self) -> list[InventorySighting]:
        return sorted(self.sightings, key=lambda item: (item.kind, item.harness or "", item.scope or "", item.label))


class SkillInventory:
    def __init__(
        self,
        *,
        columns: tuple[InventoryColumn, ...],
        harness_scans: tuple[HarnessScan, ...],
        store_issues: tuple[str, ...],
        entries: tuple[InventoryEntry, ...],
    ) -> None:
        self.columns = columns
        self.harness_scans = harness_scans
        self.store_issues = store_issues
        self.entries = entries
        self._by_ref = {entry.skill_ref: entry for entry in entries}

    @classmethod
    def from_snapshot(cls, *, store_scan: StoreScan, harness_scans: tuple[HarnessScan, ...]) -> "SkillInventory":
        columns = tuple(
            InventoryColumn(harness=scan.harness, label=scan.label)
            for scan in harness_scans
            if scan.detected and scan.manageable
        )
        entries: list[InventoryEntry] = []
        shared_path_index: dict[Path, InventoryEntry] = {}

        for store_package in store_scan.packages:
            package = store_package.package
            entry = InventoryEntry(
                skill_ref=f"shared:{package.root_path.name}",
                name=package.declared_name,
                description=package.description,
                kind="managed",
                source=package.source,
                source_label=_source_label(package.source),
                current_revision=package.revision,
                recorded_revision=store_package.recorded_revision,
                package_dir=package.root_path.name,
                package_path=package.root_path,
            )
            entry.add_sighting(
                InventorySighting(
                    kind="shared",
                    harness=None,
                    label="Shared Store",
                    scope=None,
                    path=package.root_path,
                    revision=package.revision,
                    source=package.source,
                )
            )
            entries.append(entry)
            shared_path_index[package.resolved_path] = entry

        found_entries: dict[str, InventoryEntry] = {}
        builtin_entries: dict[str, InventoryEntry] = {}

        for scan in harness_scans:
            for observation in scan.skills:
                shared_entry = shared_path_index.get(observation.package.resolved_path)
                sighting = InventorySighting(
                    kind="harness",
                    harness=observation.harness,
                    label=observation.label,
                    scope=observation.scope,
                    path=observation.package.root_path,
                    revision=observation.package.revision,
                    source=observation.package.source,
                )
                if shared_entry is not None:
                    shared_entry.add_sighting(sighting)
                    continue

                key = _found_entry_key(observation.package.declared_name, observation.package.source, observation.package.revision)
                entry = found_entries.get(key)
                if entry is None:
                    skill_ref = f"found:{key}"
                    entry = InventoryEntry(
                        skill_ref=skill_ref,
                        name=observation.package.declared_name,
                        description=observation.package.description,
                        kind="found",
                        source=observation.package.source,
                        source_label=_source_label(observation.package.source),
                        current_revision=observation.package.revision,
                    )
                    found_entries[key] = entry
                entry.add_sighting(sighting)

            for builtin in scan.builtins:
                source = SourceDescriptor(kind="builtin", locator=f"{builtin.harness}:{builtin.builtin_id}")
                key = stable_id("builtin", builtin.declared_name, builtin.builtin_id)
                entry = builtin_entries.get(key)
                if entry is None:
                    entry = InventoryEntry(
                        skill_ref=f"builtin:{key}",
                        name=builtin.declared_name,
                        description=builtin.detail,
                        kind="builtin",
                        source=source,
                        source_label="Built-in",
                    )
                    builtin_entries[key] = entry
                entry.add_sighting(
                    InventorySighting(
                        kind="builtin",
                        harness=builtin.harness,
                        label=builtin.label,
                        scope=None,
                        path=None,
                        revision=None,
                        source=source,
                        detail=builtin.detail,
                    )
                )

        entries.extend(found_entries.values())
        entries.extend(builtin_entries.values())
        entries.sort(key=_entry_sort_key)
        return cls(
            columns=columns,
            harness_scans=harness_scans,
            store_issues=store_scan.issues,
            entries=tuple(entries),
        )

    def find(self, skill_ref: str) -> InventoryEntry | None:
        return self._by_ref.get(skill_ref)

    def skills_page_dict(self) -> dict[str, object]:
        counts = {
            "managed": sum(1 for entry in self.entries if entry.display_status == "Managed"),
            "foundLocally": sum(1 for entry in self.entries if entry.display_status == "Found locally"),
            "custom": sum(1 for entry in self.entries if entry.display_status == "Custom"),
            "builtIn": sum(1 for entry in self.entries if entry.display_status == "Built-in"),
        }
        counts["needsAction"] = counts["foundLocally"] + counts["custom"]
        return {
            "summary": counts,
            "harnessColumns": [column.to_dict() for column in self.columns],
            "rows": [entry.row_dict(self.columns) for entry in self.entries],
        }

    def settings_dict(self) -> dict[str, object]:
        return {
            "harnesses": [
                {
                    "harness": scan.harness,
                    "label": scan.label,
                    "detected": scan.detected,
                    "manageable": scan.manageable,
                    "builtinSupport": scan.builtin_support,
                    "issues": list(scan.issues),
                    "diagnostics": {
                        "discoveryMode": scan.discovery_mode,
                        "detectionDetails": list(scan.detection_details),
                    },
                }
                for scan in self.harness_scans
            ],
            "storeIssues": list(self.store_issues),
            "bulkActions": {
                "canManageAll": any(entry.can_manage for entry in self.entries),
            },
        }


def _found_entry_key(declared_name: str, source: SourceDescriptor, revision: str) -> str:
    if source.is_source_backed:
        return stable_id("found", source.kind, source.locator, declared_name, revision)
    return stable_id("found", declared_name, revision)


def _source_label(source: SourceDescriptor) -> str:
    mapping = {
        "github": "GitHub",
        "agentskill": "AgentSkill",
        "centralized": "Managed Store",
        "builtin": "Built-in",
        "unmanaged-local": "Local copy",
        "shared-store": "Shared Store",
    }
    return mapping.get(source.kind, source.kind.replace("-", " ").title())


def _entry_sort_key(entry: InventoryEntry) -> tuple[int, str, str]:
    order = {
        "Managed": 0,
        "Custom": 1,
        "Found locally": 2,
        "Built-in": 3,
    }
    return (order[entry.display_status], entry.name.lower(), entry.skill_ref)
