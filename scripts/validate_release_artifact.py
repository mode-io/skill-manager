#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from skill_manager.runtime.startup import healthcheck_ready
from tests.support.marketplace_https_fixture import MarketplaceFixtureServer


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate a packaged skill-manager release artifact.")
    parser.add_argument("--artifact", required=True, help="Path to the release tar.gz artifact.")
    parser.add_argument("--version", required=True, help="Expected app version.")
    return parser.parse_args(argv)


def run(
    command: list[str],
    *,
    timeout: float = 30.0,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=True, capture_output=True, text=True, timeout=timeout, env=env)


def fetch_json(url: str) -> dict[str, object]:
    with urlopen(url, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def format_called_process_error(
    error: subprocess.CalledProcessError,
    *,
    runtime_dir: Path | None = None,
) -> str:
    parts = [
        f"command failed with exit code {error.returncode}: {' '.join(error.cmd)}",
    ]
    stdout = (error.stdout or "").strip()
    stderr = (error.stderr or "").strip()
    if stdout:
        parts.append(f"stdout:\n{stdout}")
    if stderr:
        parts.append(f"stderr:\n{stderr}")
    if runtime_dir is not None:
        log_path = runtime_dir / "server.log"
        if log_path.is_file():
            log_text = log_path.read_text(encoding="utf-8", errors="replace").strip()
            if log_text:
                parts.append(f"runtime log ({log_path}):\n{log_text}")
    return "\n\n".join(parts)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    artifact = Path(args.artifact).resolve()
    if not artifact.exists():
        raise FileNotFoundError(f"artifact not found: {artifact}")

    with tempfile.TemporaryDirectory(prefix="skill-manager-artifact-") as tmpdir:
        tmp_path = Path(tmpdir)
        with tarfile.open(artifact, "r:gz") as archive:
            archive.extractall(tmp_path)

        bundle_dir = tmp_path / "skill-manager"
        binary = bundle_dir / "skill-manager"
        license_file = bundle_dir / "LICENSE"
        if not binary.exists():
            raise RuntimeError(f"packaged executable missing: {binary}")
        if not license_file.exists():
            raise RuntimeError(f"packaged license missing: {license_file}")
        if license_file.read_text(encoding="utf-8") != (REPO_ROOT / "LICENSE").read_text(encoding="utf-8"):
            raise RuntimeError("packaged license did not match the repo root LICENSE")

        # Unsigned macOS binaries can pay a heavy first-run verification cost on a fresh path.
        version_output = run([str(binary), "--version"], timeout=120.0).stdout.strip()
        expected_version = f"skill-manager {args.version}"
        if version_output != expected_version:
            raise RuntimeError(f"unexpected version output: expected {expected_version!r}, got {version_output!r}")

        runtime_dir = tmp_path / "runtime"
        with MarketplaceFixtureServer() as fixture:
            runtime_env = dict(os.environ)
            runtime_env.update(fixture.env())
            try:
                start_output = run(
                    [
                        str(binary),
                        "start",
                        "--state-dir",
                        str(runtime_dir),
                        "--no-open-browser",
                        "--port",
                        "0",
                    ],
                    timeout=240.0,
                    env=runtime_env,
                ).stdout.strip()
            except subprocess.CalledProcessError as error:
                raise RuntimeError(format_called_process_error(error, runtime_dir=runtime_dir)) from error
            match = re.search(r"(http://127\.0\.0\.1:\d+)", start_output)
            if not match:
                raise RuntimeError(f"failed to parse runtime URL from start output: {start_output!r}")
            base_url = match.group(1)
            try:
                if not healthcheck_ready(base_url):
                    raise RuntimeError(f"packaged start returned before {base_url}/api/health was ready")

                status_output = run(
                    [str(binary), "status", "--state-dir", str(runtime_dir)],
                    timeout=60.0,
                    env=runtime_env,
                ).stdout.strip()
                if base_url not in status_output:
                    raise RuntimeError(f"status output did not include runtime URL: {status_output!r}")

                with (runtime_dir / "runtime.json").open("r", encoding="utf-8") as handle:
                    state = json.load(handle)
                if state.get("base_url") != base_url:
                    raise RuntimeError("runtime.json base_url did not match the running server")

                marketplace = fetch_json(f"{base_url}/api/marketplace/popular?limit=3")
                items = marketplace.get("items")
                if not isinstance(items, list) or not items:
                    raise RuntimeError(f"marketplace popular response was empty: {marketplace!r}")
                item_id = items[0].get("id")
                if not isinstance(item_id, str) or not item_id:
                    raise RuntimeError(f"marketplace item was missing id: {items[0]!r}")
                encoded_item_id = quote(item_id, safe="")
                detail = fetch_json(f"{base_url}/api/marketplace/items/{encoded_item_id}")
                if detail.get("id") != item_id:
                    raise RuntimeError(f"marketplace detail response did not match item id: {detail!r}")
                document = fetch_json(f"{base_url}/api/marketplace/items/{encoded_item_id}/document")
                if document.get("status") not in {"ready", "unavailable"}:
                    raise RuntimeError(f"marketplace document response was malformed: {document!r}")
            finally:
                try:
                    run([str(binary), "stop", "--state-dir", str(runtime_dir)], timeout=60.0, env=runtime_env)
                except subprocess.CalledProcessError:
                    pass
                shutil.rmtree(runtime_dir, ignore_errors=True)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
