from __future__ import annotations

from typing import Iterable

from .contracts import (
    HookBinding,
    HookHarnessScan,
    HookInventory,
    HookInventoryEntry,
    HookInventoryIssue,
)
from .store import HookSpec


def build_inventory(
    *,
    managed_hooks: Iterable[HookSpec],
    specs: Iterable[HookSpec],
    scans: Iterable[HookHarnessScan],
    issues: Iterable[HookInventoryIssue] = (),
) -> HookInventory:
    scans_tuple = tuple(scans)
    specs_tuple = tuple(specs)
    managed_tuple = tuple(managed_hooks)
    columns = tuple(scan.harness for scan in scans_tuple)

    bindings_by_id: dict[str, list[HookBinding]] = {}
    for scan in scans_tuple:
        for entry in scan.entries:
            binding = HookBinding(
                harness=scan.harness,
                id=entry.id,
                state=entry.state,
                drift_detail=entry.drift_detail,
                caveat=entry.caveat,
            )
            bindings_by_id.setdefault(entry.id, []).append(binding)

    spec_by_id = {spec.id: spec for spec in specs_tuple}
    entries: list[HookInventoryEntry] = []
    seen: set[str] = set()

    for hook in sorted(managed_tuple, key=lambda h: h.id.lower()):
        spec = spec_by_id.get(hook.id)
        bindings = tuple(bindings_by_id.get(hook.id, ()))
        entries.append(
            HookInventoryEntry(
                id=hook.id,
                display_name=hook.id,
                spec=spec,
                sightings=bindings,
                is_managed=True,
                can_enable=spec is not None,
            )
        )
        seen.add(hook.id)

    for id in sorted(id for id in bindings_by_id if id not in seen):
        entries.append(
            HookInventoryEntry(
                id=id,
                display_name=id,
                spec=spec_by_id.get(id),
                sightings=tuple(bindings_by_id[id]),
                is_managed=False,
                can_enable=True,
            )
        )

    return HookInventory(columns=columns, entries=tuple(entries), issues=tuple(issues))


__all__ = ["build_inventory"]
