from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import socket
from threading import Thread
import time

import uvicorn

from skill_manager.application import BackendContainer

from .app import create_app


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


def serve_in_thread(
    container: BackendContainer,
    *,
    host: str = "127.0.0.1",
    port: int = 0,
    frontend_dist: Path | None = None,
) -> ServerHandle:
    app = create_app(container, frontend_dist=frontend_dist)
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((host, port))
    sock.listen(2048)
    actual_host, actual_port = sock.getsockname()[:2]
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
