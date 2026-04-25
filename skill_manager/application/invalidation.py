from __future__ import annotations

from typing import Protocol


class Invalidatable(Protocol):
    def invalidate(self) -> None: ...


class InvalidationFanout:
    def __init__(self) -> None:
        self._targets: list[Invalidatable] = []

    def register(self, target: Invalidatable) -> Invalidatable:
        self._targets.append(target)
        return target

    def invalidate_all(self) -> None:
        for target in self._targets:
            target.invalidate()


__all__ = ["Invalidatable", "InvalidationFanout"]
