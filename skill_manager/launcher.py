from __future__ import annotations

import argparse
import os
from pathlib import Path
import webbrowser

from skill_manager.api import create_server
from skill_manager.application import ApplicationService


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="skill-manager",
        description="Launch the local read-only skill-manager control plane.",
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
    service = ApplicationService.from_environment(env)
    frontend_dist = Path(args.frontend_dist)
    server = create_server(service, host=args.host, port=args.port, frontend_dist=frontend_dist if frontend_dist.exists() else None)
    actual_host, actual_port = server.server_address[:2]
    url = f"http://{actual_host}:{actual_port}"
    print(url, flush=True)
    if args.open_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        return 130
    finally:
        server.server_close()
    return 0
