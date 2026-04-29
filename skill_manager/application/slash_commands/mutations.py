from __future__ import annotations

from pathlib import Path

from skill_manager.atomic_files import atomic_write_text
from skill_manager.errors import MutationError

from .models import SlashCommand, SlashCommandSyncEntry, SlashTarget, SlashTargetId
from .queries import SlashCommandQueryService
from .renderers import is_generated_document, parse_slash_command_document, render_slash_command
from .store import SlashCommandStore, validate_command_name
from .targets import default_target_ids, target_by_id


class SlashCommandMutationService:
    def __init__(
        self,
        store: SlashCommandStore,
        queries: SlashCommandQueryService,
        targets: tuple[SlashTarget, ...],
    ) -> None:
        self.store = store
        self.queries = queries
        self.targets = targets

    def create_command(
        self,
        *,
        name: str,
        description: str,
        prompt: str,
        targets: list[str] | None = None,
    ) -> dict[str, object]:
        command = self.store.create_command(
            SlashCommand(name=name, description=description, prompt=prompt)
        )
        sync = self.sync_command(command.name, targets=targets)
        payload = self.queries.get_command(command.name)
        return {"ok": sync["ok"], "command": payload, "sync": sync["sync"]}

    def update_command(
        self,
        name: str,
        *,
        description: str,
        prompt: str,
        targets: list[str] | None = None,
    ) -> dict[str, object]:
        self.store.update_command(name, description=description, prompt=prompt)
        sync = self.sync_command(name, targets=targets)
        payload = self.queries.get_command(name)
        return {"ok": sync["ok"], "command": payload, "sync": sync["sync"]}

    def sync_command(self, name: str, *, targets: list[str] | None = None) -> dict[str, object]:
        command = self.store.require_command(name)
        selected = self._selected_targets(targets)
        selected_ids = {target.id for target in selected}
        state = self.store.load_sync_state()
        previous_state = state.get(command.name, {})

        results: list[SlashCommandSyncEntry] = []
        next_state: dict[SlashTargetId, Path] = {}

        for target in selected:
            output_path = target.output_path(command.name)
            try:
                self._write_target(command, target, previous_state)
            except Exception as error:  # noqa: BLE001
                status = "blocked_manual_file" if isinstance(error, _ManualFileConflict) else "failed"
                results.append(
                    SlashCommandSyncEntry(
                        target=target.id,
                        path=output_path,
                        status=status,
                        error=str(error),
                    )
                )
                if target.id in previous_state:
                    next_state[target.id] = Path(previous_state[target.id])
                continue
            results.append(SlashCommandSyncEntry(target=target.id, path=output_path, status="synced"))
            next_state[target.id] = output_path

        for target_id, recorded_path in previous_state.items():
            if target_id in selected_ids:
                continue
            known_target = target_by_id(self.targets, target_id)
            if known_target is None:
                continue
            path = Path(recorded_path)
            try:
                self._delete_generated_file(path, recorded=True)
            except Exception as error:  # noqa: BLE001
                results.append(
                    SlashCommandSyncEntry(
                        target=known_target.id,
                        path=path,
                        status="failed",
                        error=str(error),
                    )
                )
                next_state[known_target.id] = path
                continue
            results.append(SlashCommandSyncEntry(target=known_target.id, path=path, status="removed"))

        self.store.replace_sync_state_for(command.name, next_state)
        return {
            "ok": all(entry.status in {"synced", "removed", "not_selected"} for entry in results),
            "sync": [entry.to_dict() for entry in results],
        }

    def delete_command(self, name: str) -> dict[str, object]:
        validate_command_name(name)
        self.store.require_command(name)
        previous_state = self.store.load_sync_state().get(name, {})
        results: list[SlashCommandSyncEntry] = []
        for target_id, recorded_path in previous_state.items():
            target = target_by_id(self.targets, target_id)
            if target is None:
                continue
            path = Path(recorded_path)
            try:
                self._delete_generated_file(path, recorded=True)
            except Exception as error:  # noqa: BLE001
                results.append(
                    SlashCommandSyncEntry(target=target.id, path=path, status="failed", error=str(error))
                )
                continue
            results.append(SlashCommandSyncEntry(target=target.id, path=path, status="removed"))
        self.store.delete_command(name)
        self.store.remove_sync_state_for(name)
        return {
            "ok": all(entry.status == "removed" for entry in results),
            "sync": [entry.to_dict() for entry in results],
        }

    def import_unmanaged_command(self, *, target: str, name: str) -> dict[str, object]:
        selected_target = target_by_id(self.targets, target)
        if selected_target is None:
            raise MutationError(f"unknown slash command target: {target}", status=400)
        validate_command_name(name)
        path = selected_target.output_path(name)
        if not path.is_file():
            raise MutationError(f"slash command file not found: {path}", status=404)

        command = parse_slash_command_document(
            name,
            path.read_text(encoding="utf-8"),
            selected_target.id,
        )
        existing = self.store.get_command(name)
        if existing is None:
            self.store.create_command(command)
        self.store.add_sync_state_target(name, selected_target.id, path)
        payload = self.queries.get_command(name)
        return {
            "ok": True,
            "command": payload,
            "sync": [
                SlashCommandSyncEntry(
                    target=selected_target.id,
                    path=path,
                    status="synced",
                ).to_dict()
            ],
        }

    def _selected_targets(self, targets: list[str] | None) -> tuple[SlashTarget, ...]:
        target_ids = targets if targets is not None else list(default_target_ids(self.targets))
        selected: list[SlashTarget] = []
        seen: set[str] = set()
        for target_id in target_ids:
            if target_id in seen:
                continue
            target = target_by_id(self.targets, target_id)
            if target is None:
                raise MutationError(f"unknown slash command target: {target_id}", status=400)
            selected.append(target)
            seen.add(target_id)
        return tuple(selected)

    def _write_target(
        self,
        command: SlashCommand,
        target: SlashTarget,
        previous_state: dict[str, str],
    ) -> None:
        output_path = target.output_path(command.name)
        if output_path.exists() and target.id not in previous_state:
            current = output_path.read_text(encoding="utf-8")
            if not is_generated_document(current):
                raise _ManualFileConflict(f"refusing to overwrite manual file: {output_path}")
        atomic_write_text(output_path, render_slash_command(command, target.id))

    def _delete_generated_file(self, path: Path, *, recorded: bool) -> None:
        if not path.exists():
            return
        content = path.read_text(encoding="utf-8")
        if not recorded and not is_generated_document(content):
            raise _ManualFileConflict(f"refusing to delete manual file: {path}")
        if not recorded and is_generated_document(content):
            path.unlink()
            return
        if recorded or is_generated_document(content):
            path.unlink()


class _ManualFileConflict(Exception):
    pass


__all__ = ["SlashCommandMutationService"]
