from __future__ import annotations

import json

from skill_manager.harness import CommandResult


class StubCommandRunner:
    def __init__(self) -> None:
        self._results: dict[tuple[str, ...], CommandResult] = {}

    def add_result(
        self,
        args: tuple[str, ...],
        *,
        returncode: int = 0,
        stdout: str = "",
        stderr: str = "",
    ) -> None:
        self._results[tuple(args)] = CommandResult(args=tuple(args), returncode=returncode, stdout=stdout, stderr=stderr)

    def add_json_result(self, args: tuple[str, ...], payload: object) -> None:
        self.add_result(args, stdout=json.dumps(payload))

    def run(self, args: tuple[str, ...] | list[str]) -> CommandResult:
        key = tuple(args)
        if key in self._results:
            return self._results[key]
        return CommandResult(args=key, returncode=127, stdout="", stderr=f"missing stub for {' '.join(key)}")
