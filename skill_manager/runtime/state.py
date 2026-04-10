from __future__ import annotations

from dataclasses import asdict, dataclass
import json
from pathlib import Path
import time

from .paths import state_dir


@dataclass(frozen=True)
class RuntimeState:
    pid: int
    host: str
    port: int
    base_url: str
    version: str
    executable: str
    started_at: float


def runtime_state_path(env: dict[str, str] | None = None) -> Path:
    return state_dir(env) / "runtime.json"


def runtime_log_path(env: dict[str, str] | None = None) -> Path:
    return state_dir(env) / "server.log"


def load_runtime_state(env: dict[str, str] | None = None) -> RuntimeState | None:
    path = runtime_state_path(env)
    if not path.is_file():
        return None
    payload = json.loads(path.read_text(encoding="utf-8"))
    return RuntimeState(
        pid=int(payload["pid"]),
        host=str(payload["host"]),
        port=int(payload["port"]),
        base_url=str(payload["base_url"]),
        version=str(payload["version"]),
        executable=str(payload["executable"]),
        started_at=float(payload.get("started_at", time.time())),
    )


def write_runtime_state(state: RuntimeState, env: dict[str, str] | None = None) -> Path:
    path = runtime_state_path(env)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(asdict(state), indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return path


def clear_runtime_state(env: dict[str, str] | None = None) -> None:
    path = runtime_state_path(env)
    if path.exists():
        path.unlink()
