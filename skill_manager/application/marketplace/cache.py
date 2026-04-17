from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import time
from pathlib import Path

from skill_manager.paths import resolve_app_paths


@dataclass(frozen=True)
class CachedPayload:
    payload: object
    age_seconds: float

    @property
    def is_fresh(self) -> bool:
        return self.age_seconds <= 0


@dataclass(frozen=True)
class StoredPayload:
    payload: object
    fetched_at: float
    age_seconds: float


class MarketplaceCache:
    def __init__(self, root: Path | None = None) -> None:
        self.root = root

    @classmethod
    def from_environment(cls, env: dict[str, str] | None = None) -> "MarketplaceCache":
        return cls(resolve_app_paths(env).marketplace_cache_root)

    def read(self, namespace: str, key: str, *, ttl_seconds: int) -> CachedPayload | None:
        stored = self.load(namespace, key)
        if stored is None:
            return None
        return CachedPayload(payload=stored.payload, age_seconds=max(0.0, stored.age_seconds - ttl_seconds))

    def load(self, namespace: str, key: str) -> StoredPayload | None:
        path = self._path_for(namespace, key)
        if path is None or not path.is_file():
            return None
        payload = json.loads(path.read_text(encoding="utf-8"))
        fetched_at = float(payload.get("fetchedAt", 0))
        age = max(0.0, time.time() - fetched_at)
        return StoredPayload(payload=payload.get("payload"), fetched_at=fetched_at, age_seconds=age)

    def write(self, namespace: str, key: str, payload: object) -> None:
        path = self._path_for(namespace, key)
        if path is None:
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps({"fetchedAt": time.time(), "payload": payload}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _path_for(self, namespace: str, key: str) -> Path | None:
        if self.root is None:
            return None
        digest = hashlib.sha1(key.encode("utf-8")).hexdigest()
        return self.root / namespace / f"{digest}.json"
