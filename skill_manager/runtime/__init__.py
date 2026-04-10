from .assets import resolve_frontend_dist
from .state import RuntimeState, clear_runtime_state, load_runtime_state, runtime_log_path, runtime_state_path, write_runtime_state

__all__ = [
    "ServerHandle",
    "RuntimeState",
    "choose_port",
    "clear_runtime_state",
    "load_runtime_state",
    "resolve_frontend_dist",
    "runtime_log_path",
    "runtime_state_path",
    "serve_foreground",
    "serve_in_thread",
    "write_runtime_state",
]


def __getattr__(name: str):
    if name in {"ServerHandle", "choose_port", "serve_foreground", "serve_in_thread"}:
        from .server import ServerHandle, choose_port, serve_foreground, serve_in_thread

        mapping = {
            "ServerHandle": ServerHandle,
            "choose_port": choose_port,
            "serve_foreground": serve_foreground,
            "serve_in_thread": serve_in_thread,
        }
        return mapping[name]
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
