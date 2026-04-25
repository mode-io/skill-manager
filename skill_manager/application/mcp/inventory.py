from __future__ import annotations

from typing import Iterable

from .contracts import (
    McpBinding,
    McpHarnessScan,
    McpInventory,
    McpInventoryEntry,
    McpInventoryIssue,
)
from .store import McpServerSpec


def build_inventory(
    *,
    managed_servers: Iterable[McpServerSpec],
    specs: Iterable[McpServerSpec],
    scans: Iterable[McpHarnessScan],
    issues: Iterable[McpInventoryIssue] = (),
) -> McpInventory:
    """Combine central specs + per-harness scans into a server x harness matrix."""
    scans_tuple = tuple(scans)
    specs_tuple = tuple(specs)
    managed_tuple = tuple(managed_servers)
    columns = tuple(scan.harness for scan in scans_tuple)

    bindings_by_name: dict[str, list[McpBinding]] = {}
    for scan in scans_tuple:
        for entry in scan.entries:
            binding = McpBinding(
                harness=scan.harness,
                name=entry.name,
                state=entry.state,
                drift_detail=entry.drift_detail,
            )
            bindings_by_name.setdefault(entry.name, []).append(binding)

    spec_by_name = {spec.name: spec for spec in specs_tuple}
    entries: list[McpInventoryEntry] = []
    seen: set[str] = set()

    for server in sorted(managed_tuple, key=lambda s: s.display_name.lower()):
        spec = spec_by_name.get(server.name)
        bindings = tuple(bindings_by_name.get(server.name, ()))
        entries.append(
            McpInventoryEntry(
                name=server.name,
                display_name=server.display_name,
                spec=spec,
                sightings=bindings,
                is_managed=True,
                can_enable=spec is not None,
            )
        )
        seen.add(server.name)

    for name in sorted(name for name in bindings_by_name if name not in seen):
        entries.append(
            McpInventoryEntry(
                name=name,
                display_name=name,
                spec=spec_by_name.get(name),
                sightings=tuple(bindings_by_name[name]),
                is_managed=False,
                can_enable=True,
            )
        )

    return McpInventory(columns=columns, entries=tuple(entries), issues=tuple(issues))


__all__ = ["build_inventory"]
