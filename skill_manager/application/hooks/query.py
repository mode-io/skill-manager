from __future__ import annotations

from skill_manager.errors import MutationError

from .contracts import HookHarnessScan, HookInventory, HookInventoryIssue
from .inventory import build_inventory
from .managed_state import entry_payload, inventory_payload
from .read_models import HooksReadModelService


class HooksQueryService:
    """Read-side service exposing canonical hooks config and inventory views."""

    def __init__(self, read_models: HooksReadModelService) -> None:
        self.read_models = read_models

    def list_hooks(self) -> dict[str, object]:
        snapshot = self.read_models.snapshot()
        inventory = self._inventory(snapshot.harness_scans)
        return inventory_payload(
            inventory,
            self.read_models.visible_scans(snapshot),
        )

    def get_hook(self, id: str) -> dict[str, object]:
        snapshot = self.read_models.snapshot()
        inventory = self._inventory(snapshot.harness_scans)
        visible_scans = self.read_models.visible_scans(snapshot)
        for entry in inventory.entries:
            if entry.id == id:
                return entry_payload(
                    entry,
                    visible_scans,
                )
        raise MutationError(f"unknown hook: {id}", status=404)

    def _inventory(self, scans: tuple[HookHarnessScan, ...]) -> HookInventory:
        issues = [
            HookInventoryIssue(name=issue.name, reason=issue.reason)
            for issue in self.read_models.store.manifest_issues()
        ]
        issues.extend(
            HookInventoryIssue(name=f"{scan.label} config", reason=scan.scan_issue)
            for scan in scans
            if scan.scan_issue
        )
        return build_inventory(
            managed_hooks=self.read_models.store.list_managed(),
            specs=self.read_models.store.list_managed(),
            scans=scans,
            issues=issues,
        )


__all__ = ["HooksQueryService"]
