from __future__ import annotations

from skill_manager.errors import MutationError
from skill_manager.harness import supported_harness_ids
from skill_manager.store import HarnessSupportStore

from ..read_model_service import ReadModelService


class SettingsMutationService:
    def __init__(
        self,
        read_models: ReadModelService,
        support_store: HarnessSupportStore,
    ) -> None:
        self.read_models = read_models
        self.support_store = support_store

    def set_harness_support(self, harness: str, enabled: bool) -> dict[str, object]:
        if harness not in supported_harness_ids():
            raise MutationError(f"unknown harness: {harness}", status=404)
        self.support_store.set_enabled(harness, enabled)
        self.read_models.invalidate()
        return {"ok": True, "enabled": enabled}
