from __future__ import annotations
from skill_manager.harness import HarnessLocation, HarnessStatus


def settings_payload(
    *,
    harness_statuses: tuple[HarnessStatus, ...],
    enabled_harnesses: tuple[str, ...],
) -> dict[str, object]:
    enabled_set = set(enabled_harnesses)

    return {
        "harnesses": [
            harness_payload(status, support_enabled=status.harness in enabled_set)
            for status in harness_statuses
        ],
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
        "detected": status.detected,
        "managedLocation": managed_location_payload(status.locations),
    }


def managed_location_payload(locations: tuple[HarnessLocation, ...]) -> str | None:
    store = next((location for location in locations if location.kind == "managed-root"), None)
    return str(store.path) if store is not None else None
