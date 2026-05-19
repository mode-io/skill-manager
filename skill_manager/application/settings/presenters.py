from __future__ import annotations

from skill_manager.harness import HarnessStatus
from skill_manager.platform_context import PlatformName
from skill_manager.paths import AppPaths


def settings_payload(
    *,
    paths: AppPaths,
    platform: PlatformName,
    harness_statuses: tuple[HarnessStatus, ...],
    enabled_harnesses: tuple[str, ...],
) -> dict[str, object]:
    enabled_set = set(enabled_harnesses)

    return {
        "storage": storage_payload(paths, platform=platform),
        "harnesses": [
            harness_payload(status, support_enabled=status.harness in enabled_set)
            for status in harness_statuses
        ],
    }


def storage_payload(paths: AppPaths, *, platform: PlatformName) -> dict[str, object]:
    return {
        "platform": platform,
        "configDir": str(paths.config_dir),
        "dataDir": str(paths.data_dir),
        "stateDir": str(paths.state_dir),
        "skillsStorePath": str(paths.skills_store_root),
        "marketplaceCachePath": str(paths.marketplace_cache_root),
        "settingsPath": str(paths.settings_path),
    }


def harness_payload(
    status: HarnessStatus,
    *,
    support_enabled: bool,
) -> dict[str, object]:
    return {
        "harness": status.harness,
        "label": status.label,
        "logoKey": status.logo_key,
        "supportEnabled": support_enabled,
        "installed": status.installed,
        "managedLocation": str(status.managed_location) if status.managed_location is not None else None,
    }
