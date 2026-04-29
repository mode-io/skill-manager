from __future__ import annotations

from pathlib import Path

from skill_manager.errors import MutationError

from .codecs import parse_slash_command_document
from .models import SlashCommand, SlashCommandReviewRow, SlashCommandSyncEntry, SlashTarget
from .path_policy import SlashCommandPathPolicy
from .store import SlashCommandStore
from .sync_state import SlashCommandSyncRecord, SlashCommandSyncStateStore, hash_file


class SlashCommandReadModelService:
    def __init__(
        self,
        store: SlashCommandStore,
        sync_state: SlashCommandSyncStateStore,
        targets: tuple[SlashTarget, ...],
        path_policy: SlashCommandPathPolicy | None = None,
    ) -> None:
        self.store = store
        self.sync_state = sync_state
        self.targets = targets
        self.path_policy = path_policy or SlashCommandPathPolicy()

    def list_commands(self) -> dict[str, object]:
        commands = self.store.list_commands()
        state = self.sync_state.load()
        return {
            "storePath": str(self.store.paths.commands_dir),
            "syncStatePath": str(self.sync_state.path),
            "targets": [target.to_dict() for target in self.targets],
            "defaultTargets": [target.id for target in self.targets if target.default_selected],
            "commands": [self._command_payload(command, state.get(command.name, {})) for command in commands],
            "reviewCommands": self.review_commands(commands=commands, state=state),
        }

    def get_command(self, name: str) -> dict[str, object] | None:
        command = self.store.get_command(name)
        if command is None:
            return None
        state = self.sync_state.load()
        return self._command_payload(command, state.get(command.name, {}))

    def review_commands(
        self,
        *,
        commands: tuple[SlashCommand, ...] | None = None,
        state: dict[str, dict[str, SlashCommandSyncRecord]] | None = None,
    ) -> list[dict[str, object]]:
        managed_commands = commands if commands is not None else self.store.list_commands()
        command_names = {command.name for command in managed_commands}
        sync_state = state if state is not None else self.sync_state.load()
        rows: list[SlashCommandReviewRow] = []
        rows.extend(self._tracked_review_rows(command_names, sync_state))
        rows.extend(self._unmanaged_review_rows(command_names, sync_state))
        return [row.to_dict() for row in rows]

    def _command_payload(
        self,
        command: SlashCommand,
        records: dict[str, SlashCommandSyncRecord],
    ) -> dict[str, object]:
        return {
            "name": command.name,
            "description": command.description,
            "prompt": command.prompt,
            "syncTargets": [entry.to_dict() for entry in self._sync_entries(command.name, records)],
        }

    def _sync_entries(
        self,
        command_name: str,
        records: dict[str, SlashCommandSyncRecord],
    ) -> list[SlashCommandSyncEntry]:
        entries: list[SlashCommandSyncEntry] = []
        for target in self.targets:
            record = records.get(target.id)
            if record is None:
                path = self.path_policy.output_path(target, command_name)
                entries.append(SlashCommandSyncEntry(target=target.id, path=path, status="not_selected"))
                continue
            try:
                path = self.path_policy.tracked_path(target, record.path)
            except MutationError as error:
                entries.append(
                    SlashCommandSyncEntry(
                        target=target.id,
                        path=record.path,
                        status="failed",
                        error=str(error),
                    )
                )
                continue
            if not path.exists():
                entries.append(
                    SlashCommandSyncEntry(
                        target=target.id,
                        path=path,
                        status="missing",
                        error="Managed slash command file is missing",
                    )
                )
            elif record.content_hash and hash_file(path) != record.content_hash:
                entries.append(
                    SlashCommandSyncEntry(
                        target=target.id,
                        path=path,
                        status="drifted",
                        error="Managed slash command file changed outside Skill Manager",
                    )
                )
            else:
                entries.append(SlashCommandSyncEntry(target=target.id, path=path, status="synced"))
        return entries

    def _tracked_review_rows(
        self,
        command_names: set[str],
        state: dict[str, dict[str, SlashCommandSyncRecord]],
    ) -> list[SlashCommandReviewRow]:
        rows: list[SlashCommandReviewRow] = []
        for command_name, records in state.items():
            for record in records.values():
                target = self._target(record.target)
                if target is None:
                    continue
                try:
                    path = self.path_policy.tracked_path(target, record.path)
                except MutationError as error:
                    rows.append(
                        SlashCommandReviewRow(
                            kind="drifted",
                            target=target,
                            name=command_name,
                            path=record.path,
                            description="",
                            prompt="",
                            command_exists=command_name in command_names,
                            actions=("remove_binding",),
                            error=str(error),
                        )
                    )
                    continue
                if not path.exists():
                    rows.append(
                        SlashCommandReviewRow(
                            kind="missing",
                            target=target,
                            name=command_name,
                            path=path,
                            description="",
                            prompt="",
                            command_exists=command_name in command_names,
                            actions=("restore_managed", "remove_binding"),
                            error="Managed slash command file is missing",
                        )
                    )
                    continue
                if record.content_hash and hash_file(path) != record.content_hash:
                    rows.append(
                        self._parsed_review_row(
                            kind="drifted",
                            target=target,
                            name=command_name,
                            path=path,
                            command_exists=command_name in command_names,
                            actions=("restore_managed", "adopt_target", "remove_binding"),
                            error="Managed slash command file changed outside Skill Manager",
                        )
                    )
        return rows

    def _unmanaged_review_rows(
        self,
        command_names: set[str],
        state: dict[str, dict[str, SlashCommandSyncRecord]],
    ) -> list[SlashCommandReviewRow]:
        known_paths = {
            self.path_policy.path_identity(record.path)
            for records in state.values()
            for record in records.values()
        }
        rows: list[SlashCommandReviewRow] = []
        for target in self.targets:
            if not target.output_dir.is_dir():
                continue
            for path in sorted(target.output_dir.glob(target.file_glob)):
                if self.path_policy.path_identity(path) in known_paths:
                    continue
                name = path.stem
                command_exists = name in command_names
                actions = ("adopt_target",) if command_exists else ("import",)
                rows.append(
                    self._parsed_review_row(
                        kind="unmanaged",
                        target=target,
                        name=name,
                        path=path,
                        command_exists=command_exists,
                        actions=actions,
                        error=None,
                    )
                )
        return rows

    def _parsed_review_row(
        self,
        *,
        kind: str,
        target: SlashTarget,
        name: str,
        path: Path,
        command_exists: bool,
        actions: tuple[str, ...],
        error: str | None,
    ) -> SlashCommandReviewRow:
        try:
            parsed = parse_slash_command_document(
                name,
                path.read_text(encoding="utf-8"),
                target.render_format,
            )
            return SlashCommandReviewRow(
                kind=kind,  # type: ignore[arg-type]
                target=target,
                name=name,
                path=path,
                description=parsed.description,
                prompt=parsed.prompt,
                command_exists=command_exists,
                actions=actions,  # type: ignore[arg-type]
                error=error,
            )
        except Exception as parse_error:  # noqa: BLE001
            return SlashCommandReviewRow(
                kind=kind,  # type: ignore[arg-type]
                target=target,
                name=name,
                path=path,
                description="",
                prompt="",
                command_exists=command_exists,
                actions=(),
                error=str(parse_error),
            )

    def _target(self, target_id: str) -> SlashTarget | None:
        return next((target for target in self.targets if target.id == target_id), None)


__all__ = ["SlashCommandReadModelService"]
