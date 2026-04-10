from __future__ import annotations

from skill_manager.store import HarnessSupportStore

from ..read_model_service import ReadModelService
from .presenters import settings_payload


class SettingsQueryService:
    def __init__(
        self,
        read_models: ReadModelService,
        support_store: HarnessSupportStore,
    ) -> None:
        self.read_models = read_models
        self.support_store = support_store

    def get_settings(self) -> dict[str, object]:
        return settings_payload(
            harness_statuses=self.read_models.harness_statuses(),
            enabled_harnesses=self.read_models.enabled_harnesses(),
        )
