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
        completed = subprocess.run(
            list(args),
            check=False,
            capture_output=True,
            text=True,
        )
        return CommandResult(
            args=tuple(args),
            returncode=completed.returncode,
            stdout=completed.stdout,
            stderr=completed.stderr,
        )
