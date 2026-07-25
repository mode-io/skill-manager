from __future__ import annotations

from typing import Iterable

from .contracts import (
    PermissionBinding,
    PermissionHarnessScan,
    PermissionInventory,
    PermissionInventoryEntry,
    PermissionInventoryIssue,
)
from .store import PermissionSpec


def build_inventory(
    *,
    managed_permissions: Iterable[PermissionSpec],
    specs: Iterable[PermissionSpec],
    scans: Iterable[PermissionHarnessScan],
    issues: Iterable[PermissionInventoryIssue] = (),
) -> PermissionInventory:
    scans_tuple = tuple(scans)
    specs_tuple = tuple(specs)
    managed_tuple = tuple(managed_permissions)
    columns = tuple(scan.harness for scan in scans_tuple)

    bindings_by_id: dict[str, list[PermissionBinding]] = {}
    observed_spec_by_id: dict[str, PermissionSpec] = {}
    for scan in scans_tuple:
        for entry in scan.entries:
            binding = PermissionBinding(
                harness=scan.harness,
                id=entry.id,
                state=entry.state,
                drift_detail=entry.drift_detail,
                caveat=entry.caveat,
            )
            bindings_by_id.setdefault(entry.id, []).append(binding)
            if entry.id not in observed_spec_by_id and entry.parsed_spec is not None:
                observed_spec_by_id[entry.id] = entry.parsed_spec

    spec_by_id = {spec.id: spec for spec in specs_tuple}
    entries: list[PermissionInventoryEntry] = []
    seen: set[str] = set()

    for perm in sorted(managed_tuple, key=lambda p: p.id.lower()):
        spec = spec_by_id.get(perm.id)
        bindings = tuple(bindings_by_id.get(perm.id, ()))
        entries.append(
            PermissionInventoryEntry(
                id=perm.id,
                display_name=_display_name(perm.id, spec),
                spec=spec,
                sightings=bindings,
                is_managed=True,
                can_enable=spec is not None,
            )
        )
        seen.add(perm.id)

    for id in sorted(id for id in bindings_by_id if id not in seen):
        observed_spec = observed_spec_by_id.get(id)
        entries.append(
            PermissionInventoryEntry(
                id=id,
                display_name=_display_name(id, observed_spec),
                spec=observed_spec,
                sightings=tuple(bindings_by_id[id]),
                is_managed=False,
                can_enable=True,
            )
        )

    return PermissionInventory(columns=columns, entries=tuple(entries), issues=tuple(issues))


def _display_name(fallback_id: str, spec: PermissionSpec | None) -> str:
    """Human-readable label for a permission rule.

    Unmanaged rules carry an opaque ``manual:<hash>`` id, so render the parsed
    decision/scope/pattern instead when it is available.
    """
    if spec is None:
        return fallback_id
    label = f"{spec.decision} · {spec.scope}"
    if spec.pattern:
        label += f": {spec.pattern}"
    return label


__all__ = ["build_inventory"]
