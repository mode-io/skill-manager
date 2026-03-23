from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path


@dataclass(frozen=True)
class ManifestEntry:
    package_dir: str
    declared_name: str
    source_kind: str
    source_locator: str
    revision: str

    def to_dict(self) -> dict[str, str]:
        return {
            "packageDir": self.package_dir,
            "declaredName": self.declared_name,
            "sourceKind": self.source_kind,
            "sourceLocator": self.source_locator,
            "revision": self.revision,
        }


@dataclass(frozen=True)
class StoreManifest:
    entries: tuple[ManifestEntry, ...]

    def to_dict(self) -> dict[str, object]:
        return {"entries": [entry.to_dict() for entry in self.entries]}


def load_manifest(path: Path) -> StoreManifest:
    if not path.is_file():
        return StoreManifest(entries=())
    payload = json.loads(path.read_text(encoding="utf-8"))
    entries = tuple(
        ManifestEntry(
            package_dir=item["packageDir"],
            declared_name=item["declaredName"],
            source_kind=item["sourceKind"],
            source_locator=item["sourceLocator"],
            revision=item["revision"],
        )
        for item in payload.get("entries", [])
    )
    return StoreManifest(entries=entries)


def write_manifest(path: Path, manifest: StoreManifest) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(manifest.to_dict(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
