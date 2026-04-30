from __future__ import annotations

from skill_manager.atomic_files import atomic_write_text

from .codecs import render_slash_command
from .models import SlashCommand, SlashCommandSyncEntry, SlashTarget, SlashTargetId
from .path_policy import SlashCommandPathPolicy
from .planner import SlashCommandPlanner
from .sync_state import SlashCommandSyncRecord, SlashCommandSyncStateStore, hash_file


class SlashCommandSyncExecutor:
    def __init__(
        self,
        sync_state: SlashCommandSyncStateStore,
        planner: SlashCommandPlanner,
        path_policy: SlashCommandPathPolicy,
    ) -> None:
        self.sync_state = sync_state
        self.planner = planner
        self.path_policy = path_policy

    def sync_command(
        self,
        command: SlashCommand,
        selected: tuple[SlashTarget, ...],
        all_targets: tuple[SlashTarget, ...],
    ) -> dict[str, object]:
        previous = self.sync_state.load().get(command.name, {})
        plan = self.planner.plan_sync(command, selected, previous, all_targets)

        results: list[SlashCommandSyncEntry] = list(plan.blocked)
        next_records: dict[SlashTargetId, SlashCommandSyncRecord] = dict(plan.keep)

        for write in plan.writes:
            try:
                path = write.path
                rendered = render_slash_command(command, write.target.render_format)
                path.parent.mkdir(parents=True, exist_ok=True)
                atomic_write_text(path, rendered)
                next_records[write.target.id] = SlashCommandSyncRecord(
                    target=write.target.id,
                    path=path,
                    content_hash=hash_file(path),
                    render_format=write.target.render_format,
                )
                results.append(SlashCommandSyncEntry(target=write.target.id, path=path, status="synced"))
            except Exception as error:  # noqa: BLE001
                if write.previous:
                    next_records[write.target.id] = write.previous
                results.append(
                    SlashCommandSyncEntry(
                        target=write.target.id,
                        path=write.path,
                        status="failed",
                        error=str(error),
                    )
                )

        for remove in plan.removes:
            try:
                path = self.path_policy.tracked_path(remove.target, remove.record.path)
                if path.exists():
                    path.unlink()
                results.append(
                    SlashCommandSyncEntry(
                        target=remove.target.id,
                        path=path,
                        status="removed",
                    )
                )
            except Exception as error:  # noqa: BLE001
                next_records[remove.target.id] = remove.record
                results.append(
                    SlashCommandSyncEntry(
                        target=remove.target.id,
                        path=remove.record.path,
                        status="failed",
                        error=str(error),
                    )
                )

        self.sync_state.replace_for(command.name, next_records)
        return {
            "ok": all(entry.status in {"synced", "removed", "not_selected"} for entry in results),
            "sync": [entry.to_dict() for entry in results],
        }

    def remove_tracked_outputs(
        self,
        records: dict[str, SlashCommandSyncRecord],
        all_targets: tuple[SlashTarget, ...],
    ) -> dict[str, object]:
        plan = self.planner.plan_delete(records, all_targets)
        if plan.blocked:
            return {"ok": False, "sync": [entry.to_dict() for entry in plan.blocked]}

        results: list[SlashCommandSyncEntry] = []
        for remove in plan.removes:
            try:
                path = self.path_policy.tracked_path(remove.target, remove.record.path)
                if path.exists():
                    path.unlink()
                results.append(
                    SlashCommandSyncEntry(
                        target=remove.target.id,
                        path=path,
                        status="removed",
                    )
                )
            except Exception as error:  # noqa: BLE001
                results.append(
                    SlashCommandSyncEntry(
                        target=remove.target.id,
                        path=remove.record.path,
                        status="failed",
                        error=str(error),
                    )
                )
        return {
            "ok": not any(entry.status == "failed" for entry in results),
            "sync": [entry.to_dict() for entry in results],
        }


__all__ = ["SlashCommandSyncExecutor"]
