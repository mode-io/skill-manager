from __future__ import annotations

from pathlib import Path

from .models import SlashCommand, SlashCommandSyncEntry, SlashTarget
from .renderers import parse_slash_command_document
from .store import SlashCommandStore


class SlashCommandQueryService:
    def __init__(self, store: SlashCommandStore, targets: tuple[SlashTarget, ...]) -> None:
        self.store = store
        self.targets = targets

    def list_commands(self) -> dict[str, object]:
        commands = self.store.list_commands()
        state = self.store.load_sync_state()
        return {
            "storePath": str(self.store.paths.commands_dir),
            "syncStatePath": str(self.store.paths.sync_state_path),
            "targets": [target.to_dict() for target in self.targets],
            "defaultTargets": [target.id for target in self.targets if target.default_selected],
            "commands": [self._command_payload(command, state.get(command.name, {})) for command in commands],
            "reviewCommands": self.review_commands(commands=commands, state=state),
        }

    def get_command(self, name: str) -> dict[str, object] | None:
        command = self.store.get_command(name)
        if command is None:
            return None
        state = self.store.load_sync_state()
        return self._command_payload(command, state.get(command.name, {}))

    def review_commands(
        self,
        *,
        commands: tuple[SlashCommand, ...] | None = None,
        state: dict[str, dict[str, str]] | None = None,
    ) -> list[dict[str, object]]:
        managed_commands = commands if commands is not None else self.store.list_commands()
        managed_names = {command.name for command in managed_commands}
        sync_state = state if state is not None else self.store.load_sync_state()
        managed_paths = {str(Path(path)) for targets in sync_state.values() for path in targets.values()}
        rows: list[dict[str, object]] = []
        for target in self.targets:
            if not target.output_dir.is_dir():
                continue
            for path in sorted(target.output_dir.glob("*.md")):
                resolved = str(path)
                if resolved in managed_paths:
                    continue
                name = path.stem
                try:
                    parsed = parse_slash_command_document(
                        name,
                        path.read_text(encoding="utf-8"),
                        target.id,
                    )
                except UnicodeDecodeError as error:
                    rows.append(
                        {
                            "reviewRef": f"{target.id}:{name}",
                            "target": target.id,
                            "targetLabel": target.label,
                            "name": name,
                            "path": str(path),
                            "description": "",
                            "prompt": "",
                            "commandExists": name in managed_names,
                            "canImport": False,
                            "error": str(error),
                        }
                    )
                    continue
                rows.append(
                    {
                        "reviewRef": f"{target.id}:{name}",
                        "target": target.id,
                        "targetLabel": target.label,
                        "name": name,
                        "path": str(path),
                        "description": parsed.description,
                        "prompt": parsed.prompt,
                        "commandExists": name in managed_names,
                        "canImport": True,
                        "error": None,
                    }
                )
        return rows

    def _command_payload(self, command: SlashCommand, state: dict[str, str]) -> dict[str, object]:
        return {
            "name": command.name,
            "description": command.description,
            "prompt": command.prompt,
            "syncTargets": [entry.to_dict() for entry in self._sync_entries(command.name, state)],
        }

    def _sync_entries(self, command_name: str, state: dict[str, str]) -> list[SlashCommandSyncEntry]:
        entries: list[SlashCommandSyncEntry] = []
        for target in self.targets:
            recorded = state.get(target.id)
            path = Path(recorded) if recorded else target.output_path(command_name)
            if recorded:
                output_path = Path(recorded)
                if output_path.exists():
                    entries.append(SlashCommandSyncEntry(target=target.id, path=output_path, status="synced"))
                else:
                    entries.append(
                        SlashCommandSyncEntry(
                            target=target.id,
                            path=output_path,
                            status="failed",
                            error="Generated file is missing",
                        )
                    )
            else:
                entries.append(SlashCommandSyncEntry(target=target.id, path=path, status="not_selected"))
        return entries


__all__ = ["SlashCommandQueryService"]
