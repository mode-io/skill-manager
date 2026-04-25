from __future__ import annotations

from dataclasses import dataclass
import hashlib


def stable_id(*parts: str) -> str:
    digest = hashlib.sha1()
    for part in parts:
        digest.update(part.encode("utf-8"))
        digest.update(b"\0")
    return digest.hexdigest()[:12]


@dataclass(frozen=True)
class SourceDescriptor:
    kind: str
    locator: str

    @property
    def is_source_backed(self) -> bool:
        return self.kind not in {"harness-local", "shared-store", "unmanaged-local"}


@dataclass(frozen=True)
class SkillRef:
    source: SourceDescriptor
    declared_name: str

    @property
    def value(self) -> str:
        return stable_id(self.source.kind, self.source.locator, self.declared_name)
