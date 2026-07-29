#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile
from urllib.request import urlopen


REPO_ROOT = Path(__file__).resolve().parents[1]
NPM_PACKAGE_ROOT = REPO_ROOT / "packaging" / "npm"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate the npm wrapper with a local native release artifact."
    )
    parser.add_argument("--artifact", required=True, help="Path to the native release archive.")
    return parser.parse_args(argv)


def executable(name: str) -> str:
    resolved = shutil.which(name)
    if not resolved:
        raise FileNotFoundError(f"required executable was not found on PATH: {name}")
    return resolved


def run(
    command: list[str],
    *,
    cwd: Path,
    env: dict[str, str],
    timeout: float = 120.0,
) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        command,
        cwd=cwd,
        env=env,
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"command failed ({result.returncode}): {' '.join(command)}\n"
            f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )
    return result


def wrapper_path(prefix: Path) -> Path:
    if os.name == "nt":
        return prefix / "skill-manager.cmd"
    return prefix / "bin" / "skill-manager"


def assert_package_license(package_path: Path) -> None:
    with tarfile.open(package_path, "r:gz") as archive:
        member = archive.extractfile("package/LICENSE")
        if member is None:
            raise RuntimeError("npm package did not contain package/LICENSE")
        packaged_license = member.read()
    expected_license = (REPO_ROOT / "LICENSE").read_bytes()
    if packaged_license != expected_license:
        raise RuntimeError("npm package LICENSE did not match the repository LICENSE")


def assert_health(base_url: str) -> None:
    with urlopen(f"{base_url}/api/health", timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if response.status != 200 or payload.get("ok") is not True:
        raise RuntimeError(f"unexpected health response: {payload!r}")


def runtime_cycle(
    wrapper: Path,
    *,
    state_dir: Path,
    cwd: Path,
    env: dict[str, str],
) -> None:
    start = run(
        [
            str(wrapper),
            "start",
            "--state-dir",
            str(state_dir),
            "--no-open-browser",
            "--port",
            "0",
        ],
        cwd=cwd,
        env=env,
        timeout=240,
    )
    if "skill-manager started at http://127.0.0.1:" not in start.stdout:
        raise RuntimeError(f"unexpected start output: {start.stdout!r}")
    state_path = state_dir / "runtime.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))
    base_url = str(state["base_url"])
    assert_health(base_url)

    status = run(
        [str(wrapper), "status", "--state-dir", str(state_dir)],
        cwd=cwd,
        env=env,
    )
    if base_url not in status.stdout:
        raise RuntimeError(f"status output did not include {base_url}: {status.stdout!r}")

    duplicate = run(
        [
            str(wrapper),
            "start",
            "--state-dir",
            str(state_dir),
            "--no-open-browser",
            "--port",
            "0",
        ],
        cwd=cwd,
        env=env,
    )
    if "already running" not in duplicate.stdout:
        raise RuntimeError(f"duplicate start was not detected: {duplicate.stdout!r}")

    run(
        [str(wrapper), "stop", "--state-dir", str(state_dir)],
        cwd=cwd,
        env=env,
    )
    if state_path.exists():
        raise RuntimeError("runtime state remained after stop")


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    artifact = Path(args.artifact).resolve(strict=True)
    checksum = Path(f"{artifact}.sha256")
    if not checksum.is_file():
        raise FileNotFoundError(f"artifact checksum not found: {checksum}")

    npm = executable("npm")
    with tempfile.TemporaryDirectory(prefix="skill-manager-npm-") as temp:
        root = Path(temp)
        home = root / "用户 home"
        roaming = root / "Roaming Data"
        local = root / "Local Data"
        prefix = root / "global prefix"
        state_dir = root / "runtime state"
        for path in (home, roaming, local, prefix):
            path.mkdir(parents=True, exist_ok=True)

        env = dict(os.environ)
        env.update(
            {
                "HOME": str(home),
                "USERPROFILE": str(home),
                "APPDATA": str(roaming),
                "LOCALAPPDATA": str(local),
                "SKILL_MANAGER_LOCAL_ARTIFACT_PATH": str(artifact),
            }
        )

        packed = run(
            [npm, "pack", "--json", str(NPM_PACKAGE_ROOT)],
            cwd=root,
            env=env,
        )
        package_metadata = json.loads(packed.stdout)
        package_path = root / str(package_metadata[0]["filename"])
        assert_package_license(package_path)

        run(
            [
                npm,
                "install",
                "--global",
                "--prefix",
                str(prefix),
                "--no-package-lock",
                str(package_path),
            ],
            cwd=root,
            env=env,
            timeout=240,
        )
        wrapper = wrapper_path(prefix)
        if not wrapper.is_file():
            raise RuntimeError(f"global npm wrapper was not installed: {wrapper}")

        version = run([str(wrapper), "--version"], cwd=root, env=env)
        if not version.stdout.startswith("skill-manager "):
            raise RuntimeError(f"unexpected version output: {version.stdout!r}")

        for _ in range(2):
            runtime_cycle(wrapper, state_dir=state_dir, cwd=root, env=env)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
