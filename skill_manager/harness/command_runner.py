from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, Sequence
import subprocess


@dataclass(frozen=True)
class CommandResult:
    args: tuple[str, ...]
    returncode: int
    stdout: str
    stderr: str


class CommandRunner(Protocol):
    def run(self, args: Sequence[str]) -> CommandResult:
        ...


class SubprocessCommandRunner:
    def run(self, args: Sequence[str]) -> CommandResult:
        try:
            completed = subprocess.run(
                list(args),
                check=False,
                capture_output=True,
                text=True,
            )
        except FileNotFoundError as error:
            missing = args[0] if args else "command"
            return CommandResult(
                args=tuple(args),
                returncode=127,
                stdout="",
                stderr=str(error) or f"{missing}: command not found",
            )
        return CommandResult(
            args=tuple(args),
            returncode=completed.returncode,
            stdout=completed.stdout,
            stderr=completed.stderr,
        )
