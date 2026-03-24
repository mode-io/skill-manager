from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SkillListing:
    name: str
    description: str
    source_kind: str
    source_locator: str
    registry: str
    installs: int = 0


def listing_to_json(listing: SkillListing) -> dict[str, object]:
    return {
        "name": listing.name,
        "description": listing.description,
        "sourceKind": listing.source_kind,
        "sourceLocator": listing.source_locator,
        "registry": listing.registry,
        "installs": listing.installs,
    }
