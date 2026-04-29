from __future__ import annotations

import re
import tomllib
from dataclasses import dataclass
from pathlib import Path

import tomli_w

from skill_manager.atomic_files import atomic_write_text, file_lock
from skill_manager.errors import MutationError

from .models import SlashCommand


COMMAND_NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


@dataclass(frozen=True)
class SlashCommandStorePaths:
    root: Path
    commands_dir: Path


class SlashCommandStore:
    def __init__(self, paths: SlashCommandStorePaths) -> None:
        self.paths = paths

    @property
    def lock_path(self) -> Path:
        return self.paths.root / ".lock"

    def list_commands(self) -> tuple[SlashCommand, ...]:
        if not self.paths.commands_dir.is_dir():
            return ()
        return tuple(self._read_command_path(path) for path in sorted(self.paths.commands_dir.glob("*.toml")))

    def get_command(self, name: str) -> SlashCommand | None:
        validate_command_name(name)
        path = self.command_path(name)
        if not path.is_file():
            return None
        return self._read_command_path(path)

    def require_command(self, name: str) -> SlashCommand:
        command = self.get_command(name)
        if command is None:
            raise MutationError(f"unknown slash command: {name}", status=404)
        return command

    def create_command(self, command: SlashCommand) -> SlashCommand:
        validate_command(command)
        with file_lock(self.lock_path):
            path = self.command_path(command.name)
            if path.exists():
                raise MutationError(f"slash command already exists: {command.name}", status=409)
            self._write_command_path(path, command)
        return command

    def upsert_command(self, command: SlashCommand) -> SlashCommand:
        validate_command(command)
        with file_lock(self.lock_path):
            self._write_command_path(self.command_path(command.name), command)
        return command

    def update_command(self, name: str, *, description: str, prompt: str) -> SlashCommand:
        validate_command_name(name)
        command = SlashCommand(name=name, description=description, prompt=prompt)
        validate_command(command)
        with file_lock(self.lock_path):
            path = self.command_path(name)
            if not path.is_file():
                raise MutationError(f"unknown slash command: {name}", status=404)
            self._write_command_path(path, command)
        return command

    def delete_command(self, name: str) -> None:
        validate_command_name(name)
        with file_lock(self.lock_path):
            path = self.command_path(name)
            if not path.is_file():
                raise MutationError(f"unknown slash command: {name}", status=404)
            path.unlink()

    def command_path(self, name: str) -> Path:
        return self.paths.commands_dir / f"{name}.toml"

    def _read_command_path(self, path: Path) -> SlashCommand:
        try:
            payload = tomllib.loads(path.read_text(encoding="utf-8"))
        except tomllib.TOMLDecodeError as error:
            raise MutationError(f"{path.name}: invalid command TOML", status=400) from error
        command = SlashCommand(
            name=_string_field(payload, "name"),
            description=_string_field(payload, "description"),
            prompt=_string_field(payload, "prompt"),
        )
        try:
            validate_command(command)
        except MutationError as error:
            raise MutationError(f"{path.name}: {error}", status=400) from error
        if path.stem != command.name:
            raise MutationError(
                f"{path.name}: command name must match filename '{path.stem}'",
                status=400,
            )
        return command

    def _write_command_path(self, path: Path, command: SlashCommand) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = tomli_w.dumps(
            {
                "name": command.name,
                "description": command.description.strip(),
                "prompt": command.prompt.rstrip(),
            }
        )
        atomic_write_text(path, payload)


def validate_command(command: SlashCommand) -> None:
    validate_command_name(command.name)
    if not command.description.strip():
        raise MutationError("description is required", status=400)
    if not command.prompt.strip():
        raise MutationError("prompt is required", status=400)


def validate_command_name(name: str) -> None:
    if not COMMAND_NAME_RE.match(name):
        raise MutationError(
            "name must use lowercase letters, numbers, and hyphens",
            status=400,
        )


def _string_field(payload: dict[str, object], key: str) -> str:
    value = payload.get(key, "")
    return value if isinstance(value, str) else ""


__all__ = [
    "SlashCommandStore",
    "SlashCommandStorePaths",
    "validate_command",
    "validate_command_name",
]
