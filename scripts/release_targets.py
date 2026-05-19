from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import platform
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
TARGETS_FILE = REPO_ROOT / "packaging" / "npm" / "release-targets.json"


@dataclass(frozen=True)
class ReleaseTarget:
    id: str
    platform: str
    arch: str
    node_platform: str
    node_arch: str
    machine_aliases: tuple[str, ...]


def load_release_targets(path: Path = TARGETS_FILE) -> tuple[ReleaseTarget, ...]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    targets = payload.get("targets")
    if not isinstance(targets, list):
        raise RuntimeError(f"release target file is missing a targets list: {path}")
    return tuple(_target_from_payload(item) for item in targets)


def resolve_current_target(
    *,
    system: str | None = None,
    machine: str | None = None,
    targets: tuple[ReleaseTarget, ...] | None = None,
) -> ReleaseTarget:
    active_system = (system or platform.system()).lower()
    active_machine = (machine or platform.machine()).lower()
    for target in targets or load_release_targets():
        if target.platform == active_system and active_machine in target.machine_aliases:
            return target
    raise RuntimeError(
        f"no packaged release target for platform={active_system} architecture={active_machine}"
    )


def target_by_id(target_id: str, targets: tuple[ReleaseTarget, ...] | None = None) -> ReleaseTarget:
    for target in targets or load_release_targets():
        if target.id == target_id:
            return target
    raise RuntimeError(f"unknown release target: {target_id}")


def artifact_name(version: str, target: ReleaseTarget) -> str:
    return f"skill-manager-v{version}-{target.id}.tar.gz"


def _target_from_payload(item: Any) -> ReleaseTarget:
    if not isinstance(item, dict):
        raise RuntimeError(f"release target entries must be objects: {item!r}")
    return ReleaseTarget(
        id=str(item["id"]),
        platform=str(item["platform"]),
        arch=str(item["arch"]),
        node_platform=str(item["nodePlatform"]),
        node_arch=str(item["nodeArch"]),
        machine_aliases=tuple(str(alias).lower() for alias in item["machineAliases"]),
    )


__all__ = ["ReleaseTarget", "artifact_name", "load_release_targets", "resolve_current_target", "target_by_id"]
