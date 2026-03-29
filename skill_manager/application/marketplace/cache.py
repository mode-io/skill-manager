from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import time
from pathlib import Path


def default_marketplace_cache_root(env: dict[str, str] | None = None) -> Path:
    active_env = env or {}
    home = Path(active_env.get("HOME", str(Path.home())))
    xdg_data_home = Path(active_env.get("XDG_DATA_HOME", home / ".local" / "share"))
    return xdg_data_home / "skill-manager" / "marketplace"


@dataclass(frozen=True)
class CachedPayload:
    payload: object
    age_seconds: float

    @property
    def is_fresh(self) -> bool:
        return self.age_seconds <= 0


class MarketplaceCache:
    def __init__(self, root: Path | None = None) -> None:
        self.root = root

    @classmethod
    def from_environment(cls, env: dict[str, str] | None = None) -> "MarketplaceCache":
        return cls(default_marketplace_cache_root(env))

    def read(self, namespace: str, key: str, *, ttl_seconds: int) -> CachedPayload | None:
        path = self._path_for(namespace, key)
        if path is None or not path.is_file():
            return None
        payload = json.loads(path.read_text(encoding="utf-8"))
        fetched_at = float(payload.get("fetchedAt", 0))
        age = time.time() - fetched_at
        return CachedPayload(payload=payload.get("payload"), age_seconds=max(0.0, age - ttl_seconds))

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
