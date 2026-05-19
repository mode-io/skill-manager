from __future__ import annotations

from skill_manager.harness import HarnessKernelService
from skill_manager.paths import AppPaths

from .presenters import settings_payload


class SettingsQueryService:
    def __init__(self, harness_kernel: HarnessKernelService, paths: AppPaths) -> None:
        self.harness_kernel = harness_kernel
        self.paths = paths

    def get_settings(self) -> dict[str, object]:
        return settings_payload(
            paths=self.paths,
            platform=self.harness_kernel.context.platform,
            harness_statuses=self.harness_kernel.harness_statuses(),
            enabled_harnesses=self.harness_kernel.enabled_harness_ids(),
        )
