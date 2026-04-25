from __future__ import annotations

from skill_manager.harness import HarnessKernelService

from .presenters import settings_payload


class SettingsQueryService:
    def __init__(self, harness_kernel: HarnessKernelService) -> None:
        self.harness_kernel = harness_kernel

    def get_settings(self) -> dict[str, object]:
        return settings_payload(
            harness_statuses=self.harness_kernel.harness_statuses(),
            enabled_harnesses=self.harness_kernel.enabled_harness_ids(),
        )
