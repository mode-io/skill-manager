from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time

from skill_manager import __version__
from skill_manager.runtime.browser import maybe_open_browser
from skill_manager.paths import STATE_DIR_ENV
from skill_manager.runtime.process import is_owned_runtime_process, terminate_process
from skill_manager.runtime.state import (
    RuntimeState,
    clear_runtime_state,
    load_runtime_state,
    runtime_log_path,
    write_runtime_state,
)
from skill_manager.runtime.startup import startup_timeout_seconds, wait_for_health


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000
COMMANDS = {"serve", "start", "stop", "status"}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="skill-manager",
        description="Launch and manage the local skill-manager app.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    subparsers = parser.add_subparsers(dest="command")

    serve_parser = subparsers.add_parser("serve", help="Run the app server in the foreground.")
    add_server_options(serve_parser)

    start_parser = subparsers.add_parser("start", help="Launch one managed background app instance.")
    add_server_options(start_parser)

    stop_parser = subparsers.add_parser("stop", help="Stop the managed background app instance.")
    stop_parser.add_argument("--state-dir", help="Override the runtime state directory.")

    status_parser = subparsers.add_parser("status", help="Show status for the managed background instance.")
    status_parser.add_argument("--state-dir", help="Override the runtime state directory.")

    return parser


def add_server_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", default=DEFAULT_PORT, type=int)
    parser.add_argument(
        "--frontend-dist",
        default=None,
        help="Override the frontend build directory for this launch.",
    )
    parser.add_argument(
        "--open-browser",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Open the browser automatically after startup.",
    )
    parser.add_argument("--state-dir", help="Override the runtime state directory.")


def normalize_argv(argv: list[str] | None) -> list[str]:
    args = list(sys.argv[1:] if argv is None else argv)
    if not args:
        return ["serve"]
    first = args[0]
    if first in COMMANDS or first in {"-h", "--help", "--version"}:
        return args
    return ["serve", *args]


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(normalize_argv(argv))
    if args.command == "start":
        return start_command(args)
    if args.command == "stop":
        return stop_command(args)
    if args.command == "status":
        return status_command(args)
    return serve_command(args)


def serve_command(args: argparse.Namespace) -> int:
    from skill_manager.application import build_backend_container
    from skill_manager.runtime.server import serve_foreground

    env = runtime_env(args.state_dir)
    container = build_backend_container(env)
    return serve_foreground(
        container,
        host=args.host,
        port=args.port,
        frontend_dist=args.frontend_dist,
        open_browser=args.open_browser,
    )


def start_command(args: argparse.Namespace) -> int:
    from skill_manager.runtime.server import choose_port

    env = runtime_env(args.state_dir)
    existing = load_runtime_state(env)
    if existing is not None and is_owned_runtime_process(existing):
        print(f"skill-manager is already running at {existing.base_url} (pid {existing.pid})")
        maybe_open_browser(existing.base_url, enabled=args.open_browser)
        return 0
    if existing is not None:
        clear_runtime_state(env)

    port = choose_port(args.host, args.port)
    url = f"http://{args.host}:{port}"
    log_path = runtime_log_path(env)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    command = self_command(
        "serve",
        "--host",
        args.host,
        "--port",
        str(port),
        "--no-open-browser",
        *frontend_dist_args(args.frontend_dist),
        *state_dir_args(args.state_dir),
    )
    with log_path.open("ab") as log_file:
        process = subprocess.Popen(
            command,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            cwd=os.getcwd(),
            env=env,
            start_new_session=True,
        )
    timeout_seconds = startup_timeout_seconds()
    if not wait_for_health(url, timeout_seconds=timeout_seconds):
        terminate_process(process.pid)
        print(
            f"skill-manager failed to start within {timeout_seconds:.0f} seconds. See log: {log_path}",
            file=sys.stderr,
        )
        return 1

    write_runtime_state(
        RuntimeState(
            pid=process.pid,
            host=args.host,
            port=port,
            base_url=url,
            version=__version__,
            executable=sys.executable,
            started_at=time.time(),
        ),
        env,
    )
    print(f"skill-manager started at {url} (pid {process.pid})")
    maybe_open_browser(url, enabled=args.open_browser)
    return 0


def stop_command(args: argparse.Namespace) -> int:
    env = runtime_env(args.state_dir)
    state = load_runtime_state(env)
    if state is None:
        print("skill-manager is not running.")
        return 0
    if not is_owned_runtime_process(state):
        clear_runtime_state(env)
        print("No managed skill-manager background instance is running.")
        return 0
    terminate_process(state.pid)
    clear_runtime_state(env)
    print(f"Stopped skill-manager at {state.base_url} (pid {state.pid})")
    return 0


def status_command(args: argparse.Namespace) -> int:
    env = runtime_env(args.state_dir)
    state = load_runtime_state(env)
    if state is None:
        print("skill-manager is not running.")
        return 0
    if not is_owned_runtime_process(state):
        clear_runtime_state(env)
        print("skill-manager is not running.")
        return 0
    print(f"skill-manager is running at {state.base_url} (pid {state.pid})")
    return 0


def runtime_env(state_dir: str | None) -> dict[str, str]:
    env = dict(os.environ)
    if state_dir:
        env[STATE_DIR_ENV] = state_dir
    return env


def self_command(*args: str) -> list[str]:
    if getattr(sys, "frozen", False):
        return [sys.executable, *args]
    return [sys.executable, "-m", "skill_manager", *args]


def frontend_dist_args(frontend_dist: str | None) -> list[str]:
    if not frontend_dist:
        return []
    return ["--frontend-dist", frontend_dist]


def state_dir_args(state_dir: str | None) -> list[str]:
    if not state_dir:
        return []
    return ["--state-dir", state_dir]
