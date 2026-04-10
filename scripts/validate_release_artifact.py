#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import tarfile
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen

REPO_ROOT = Path(__file__).resolve().parents[1]


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate a packaged skill-manager release artifact.")
    parser.add_argument("--artifact", required=True, help="Path to the release tar.gz artifact.")
    parser.add_argument("--version", required=True, help="Expected app version.")
    return parser.parse_args(argv)


def run(command: list[str], *, timeout: float = 30.0) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=True, capture_output=True, text=True, timeout=timeout)


def wait_for_health(base_url: str, *, timeout_seconds: float = 15.0) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urlopen(f"{base_url}/api/health", timeout=2.0) as response:
                if response.status == 200:
                    return
        except Exception:  # noqa: BLE001
            time.sleep(0.1)
    raise RuntimeError(f"timed out waiting for {base_url}/api/health")


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
            timeout=120.0,
        ).stdout.strip()
        match = re.search(r"(http://127\.0\.0\.1:\d+)", start_output)
        if not match:
            raise RuntimeError(f"failed to parse runtime URL from start output: {start_output!r}")
        base_url = match.group(1)
        try:
            wait_for_health(base_url)

            status_output = run(
                [str(binary), "status", "--state-dir", str(runtime_dir)],
                timeout=60.0,
            ).stdout.strip()
            if base_url not in status_output:
                raise RuntimeError(f"status output did not include runtime URL: {status_output!r}")

            with (runtime_dir / "runtime.json").open("r", encoding="utf-8") as handle:
                state = json.load(handle)
            if state.get("base_url") != base_url:
                raise RuntimeError("runtime.json base_url did not match the running server")
        finally:
            run([str(binary), "stop", "--state-dir", str(runtime_dir)], timeout=60.0)
            shutil.rmtree(runtime_dir, ignore_errors=True)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
