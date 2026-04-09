from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import socket
from threading import Thread
import time

import uvicorn

from skill_manager.application import BackendContainer
from skill_manager.api.app import create_app

from .assets import resolve_frontend_dist
from .browser import maybe_open_browser


@dataclass
class ServerHandle:
    server: uvicorn.Server
    thread: Thread
    base_url: str
    socket_handle: socket.socket

    def stop(self) -> None:
        self.server.should_exit = True
        self.thread.join(timeout=5)
        self.socket_handle.close()


def choose_port(host: str, preferred_port: int) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, preferred_port))
        except OSError:
            sock.bind((host, 0))
        return int(sock.getsockname()[1])


def bind_socket(host: str, port: int) -> tuple[socket.socket, str, int]:
    chosen_port = choose_port(host, port)
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((host, chosen_port))
    sock.listen(2048)
    actual_host, actual_port = sock.getsockname()[:2]
    return sock, str(actual_host), int(actual_port)


def serve_foreground(
    container: BackendContainer,
    *,
    host: str = "127.0.0.1",
    port: int = 8000,
    frontend_dist: str | Path | None = None,
    open_browser: bool = True,
) -> int:
    resolved_frontend = resolve_frontend_dist(frontend_dist)
    app = create_app(container, frontend_dist=resolved_frontend)
    sock, actual_host, actual_port = bind_socket(host, port)
    url = f"http://{actual_host}:{actual_port}"
    print(url, flush=True)
    maybe_open_browser(url, enabled=open_browser)
    try:
        config = uvicorn.Config(app, fd=sock.fileno(), log_level="info", access_log=False)
        server = uvicorn.Server(config)
        server.run()
        return 0
    finally:
        sock.close()


def serve_in_thread(
    container: BackendContainer,
    *,
    host: str = "127.0.0.1",
    port: int = 0,
    frontend_dist: str | Path | None = None,
) -> ServerHandle:
    resolved_frontend = resolve_frontend_dist(frontend_dist)
    app = create_app(container, frontend_dist=resolved_frontend)
    sock, actual_host, actual_port = bind_socket(host, port)
    config = uvicorn.Config(
        app,
        fd=sock.fileno(),
        log_level="warning",
        access_log=False,
    )
    server = uvicorn.Server(config=config)
    thread = Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.time() + 5
    while not server.started and thread.is_alive() and time.time() < deadline:
        time.sleep(0.01)
    if not server.started:
        server.should_exit = True
        thread.join(timeout=5)
        sock.close()
        raise RuntimeError("uvicorn server failed to start")
    return ServerHandle(server=server, thread=thread, base_url=f"http://{actual_host}:{actual_port}", socket_handle=sock)
