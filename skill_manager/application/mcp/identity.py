from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Iterable

from .contracts import McpHarnessScan
from .store import McpServerSpec


@dataclass(frozen=True)
class HarnessSighting:
    harness: str
    label: str
    logo_key: str | None
    config_path: str | None
    payload: dict[str, object]
    spec: McpServerSpec


@dataclass(frozen=True)
class ServerIdentityGroup:
    name: str
    identical: bool
    canonical_spec: McpServerSpec | None
    sightings: tuple[HarnessSighting, ...]

    @property
    def harnesses(self) -> tuple[str, ...]:
        return tuple(s.harness for s in self.sightings)


@dataclass(frozen=True)
class AdoptionIssue:
    name: str
    harness: str
    label: str
    config_path: str | None
    reason: str
    payload: dict[str, object] | None


@dataclass(frozen=True)
class AdoptionPlan:
    groups: tuple[ServerIdentityGroup, ...]
    issues: tuple[AdoptionIssue, ...]


def build_identity_plan(
    scans: Iterable[McpHarnessScan],
    *,
    excluded_names: Iterable[str] = (),
) -> AdoptionPlan:
    excluded = set(excluded_names)
    by_name: dict[str, list[HarnessSighting]] = {}
    issues: list[AdoptionIssue] = []

    for scan in scans:
        for entry in scan.entries:
            if entry.state != "unmanaged":
                continue
            if entry.name in excluded:
                continue
            if entry.parsed_spec is None:
                issues.append(
                    AdoptionIssue(
                        name=entry.name,
                        harness=scan.harness,
                        label=scan.label,
                        config_path=str(scan.config_path) if scan.config_present else None,
                        reason=entry.parse_issue or "unable to parse unmanaged MCP entry",
                        payload=entry.raw_payload,
                    )
                )
                continue
            by_name.setdefault(entry.name, []).append(
                HarnessSighting(
                    harness=scan.harness,
                    label=scan.label,
                    logo_key=scan.logo_key,
                    config_path=str(scan.config_path) if scan.config_present else None,
                    payload=dict(entry.raw_payload or {}),
                    spec=entry.parsed_spec,
                )
            )

    groups: list[ServerIdentityGroup] = []
    for name, sightings in sorted(by_name.items()):
        keys = {_structural_key(s.spec) for s in sightings}
        identical = len(keys) == 1
        groups.append(
            ServerIdentityGroup(
                name=name,
                identical=identical,
                canonical_spec=sightings[0].spec if identical else None,
                sightings=tuple(sightings),
            )
        )
    return AdoptionPlan(groups=tuple(groups), issues=tuple(issues))


def _structural_key(spec: McpServerSpec) -> str:
    payload = {
        "name": spec.name,
        "transport": spec.transport,
        "command": spec.command,
        "args": list(spec.args) if spec.args else None,
        "env": dict(spec.env) if spec.env else None,
        "url": spec.url,
        "headers": dict(spec.headers) if spec.headers else None,
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()


__all__ = [
    "AdoptionIssue",
    "AdoptionPlan",
    "HarnessSighting",
    "ServerIdentityGroup",
    "build_identity_plan",
]
