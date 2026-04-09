from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path
import socket
import webbrowser

import uvicorn

from skill_manager.api import create_app
from skill_manager.application import build_backend_container


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="skill-manager",
        description="Launch the local skill-manager control plane.",
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=0, type=int)
    parser.add_argument(
        "--frontend-dist",
        default=str(Path.cwd() / "frontend" / "dist"),
        help="Static frontend build directory to serve when available.",
    )
    parser.add_argument(
        "--open-browser",
        action=argparse.BooleanOptionalAction,
        default=False,
        help="Open the browser automatically after startup.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    env = dict(os.environ)
    container = build_backend_container(env)
    frontend_dist = Path(args.frontend_dist)
    app = create_app(container, frontend_dist=frontend_dist if frontend_dist.exists() else None)
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((args.host, args.port))
    sock.listen(2048)
    actual_host, actual_port = sock.getsockname()[:2]
    url = f"http://{actual_host}:{actual_port}"
    print(url, flush=True)
    if args.open_browser:
        webbrowser.open(url)
    try:
        config = uvicorn.Config(app, fd=sock.fileno(), log_level="info", access_log=False)
        server = uvicorn.Server(config)
        asyncio.run(server.serve())
    except KeyboardInterrupt:
        return 130
    finally:
        sock.close()
    return 0
