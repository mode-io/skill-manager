from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .models import SlashCommand, SlashCommandSyncEntry, SlashTarget, SlashTargetId
from .path_policy import SlashCommandPathPolicy
from .sync_state import SlashCommandSyncRecord, hash_file


@dataclass(frozen=True)
class PlannedWrite:
    target: SlashTarget
    previous: SlashCommandSyncRecord | None
    path: Path


@dataclass(frozen=True)
class PlannedRemove:
    target: SlashTarget
    record: SlashCommandSyncRecord


@dataclass(frozen=True)
class SlashSyncPlan:
    writes: tuple[PlannedWrite, ...]
    removes: tuple[PlannedRemove, ...]
    blocked: tuple[SlashCommandSyncEntry, ...]
    keep: dict[SlashTargetId, SlashCommandSyncRecord]


class SlashCommandPlanner:
    def __init__(self, path_policy: SlashCommandPathPolicy | None = None) -> None:
        self.path_policy = path_policy or SlashCommandPathPolicy()

    def plan_sync(
        self,
        command: SlashCommand,
        selected: tuple[SlashTarget, ...],
        previous: dict[str, SlashCommandSyncRecord],
        all_targets: tuple[SlashTarget, ...],
    ) -> SlashSyncPlan:
        selected_ids = {target.id for target in selected}
        writes: list[PlannedWrite] = []
        removes: list[PlannedRemove] = []
        blocked: list[SlashCommandSyncEntry] = []
        keep: dict[SlashTargetId, SlashCommandSyncRecord] = {}

        for target in selected:
            record = previous.get(target.id)
            try:
                path = (
                    self.path_policy.tracked_path(target, record.path)
                    if record is not None
                    else self.path_policy.output_path(target, command.name)
                )
            except Exception as error:  # noqa: BLE001
                blocked.append(
                    SlashCommandSyncEntry(
                        target=target.id,
                        path=record.path if record is not None else self.path_policy.output_path(target, command.name),
                        status="failed",
                        error=str(error),
                    )
                )
                if record:
                    keep[target.id] = record
                continue
            block = self._write_block(target, path, record)
            if block:
                blocked.append(block)
                if record:
                    keep[target.id] = record
                continue
            writes.append(PlannedWrite(target=target, previous=record, path=path))

        for target_id, record in previous.items():
            if target_id in selected_ids:
                continue
            target = next((candidate for candidate in all_targets if candidate.id == target_id), None)
            if target is None:
                keep[record.target] = record
                continue
            block = self._remove_block(target, record)
            if block:
                blocked.append(block)
                keep[record.target] = record
                continue
            removes.append(PlannedRemove(target=target, record=record))

        return SlashSyncPlan(tuple(writes), tuple(removes), tuple(blocked), keep)

    def plan_delete(
        self,
        records: dict[str, SlashCommandSyncRecord],
        all_targets: tuple[SlashTarget, ...],
    ) -> SlashSyncPlan:
        removes: list[PlannedRemove] = []
        blocked: list[SlashCommandSyncEntry] = []
        keep: dict[SlashTargetId, SlashCommandSyncRecord] = {}
        for target_id, record in records.items():
            target = next((candidate for candidate in all_targets if candidate.id == target_id), None)
            if target is None:
                keep[record.target] = record
                continue
            block = self._remove_block(target, record)
            if block:
                blocked.append(block)
                keep[record.target] = record
            else:
                removes.append(PlannedRemove(target=target, record=record))
        return SlashSyncPlan((), tuple(removes), tuple(blocked), keep)

    def _write_block(
        self,
        target: SlashTarget,
        path: Path,
        record: SlashCommandSyncRecord | None,
    ) -> SlashCommandSyncEntry | None:
        if record is None:
            if path.exists():
                return SlashCommandSyncEntry(
                    target=target.id,
                    path=path,
                    status="blocked_manual_file",
                    error=f"refusing to overwrite manual file: {path}",
                )
            return None
        try:
            record_path = self.path_policy.tracked_path(target, record.path)
        except Exception as error:  # noqa: BLE001
            return SlashCommandSyncEntry(
                target=target.id,
                path=record.path,
                status="failed",
                error=str(error),
            )
        if record_path.exists() and record.content_hash and hash_file(record_path) != record.content_hash:
            return SlashCommandSyncEntry(
                target=target.id,
                path=record_path,
                status="blocked_modified_file",
                error=f"refusing to overwrite modified managed file: {record_path}",
            )
        return None

    def _remove_block(
        self,
        target: SlashTarget,
        record: SlashCommandSyncRecord,
    ) -> SlashCommandSyncEntry | None:
        try:
            record_path = self.path_policy.tracked_path(target, record.path)
        except Exception as error:  # noqa: BLE001
            return SlashCommandSyncEntry(
                target=target.id,
                path=record.path,
                status="failed",
                error=str(error),
            )
        if record_path.exists() and record.content_hash and hash_file(record_path) != record.content_hash:
            return SlashCommandSyncEntry(
                target=target.id,
                path=record_path,
                status="blocked_modified_file",
                error=f"refusing to delete modified managed file: {record_path}",
            )
        return None


__all__ = ["PlannedRemove", "PlannedWrite", "SlashCommandPlanner", "SlashSyncPlan"]
