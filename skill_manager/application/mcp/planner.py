from __future__ import annotations

from skill_manager.errors import MutationError

from .identity import AdoptionPlan, ServerIdentityGroup, build_identity_plan
from .read_models import McpReadModelService


class McpAdoptionPlanner:
    def __init__(self, read_models: McpReadModelService) -> None:
        self.read_models = read_models

    def plan(self) -> AdoptionPlan:
        snapshot = self.read_models.snapshot()
        managed_names = {server.name for server in self.read_models.store.list_managed()}
        return build_identity_plan(
            snapshot.harness_scans,
            excluded_names=managed_names,
        )

    def require_group(self, name: str) -> ServerIdentityGroup:
        plan = self.plan()
        for group in plan.groups:
            if group.name == name:
                return group
        raise MutationError(f"no unmanaged server named '{name}'", status=404)


__all__ = ["McpAdoptionPlanner"]
