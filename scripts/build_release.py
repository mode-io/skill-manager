#!/usr/bin/env python3
from __future__ import annotations

import argparse
from hashlib import sha256
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tarfile


REPO_ROOT = Path(__file__).resolve().parents[1]
VERSION_FILE = REPO_ROOT / "skill_manager" / "VERSION"
SPEC_FILE = REPO_ROOT / "packaging" / "pyinstaller" / "skill-manager.spec"
ARTIFACTS_DIR = REPO_ROOT / ".artifacts" / "release"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build a macOS release artifact for skill-manager.")
    parser.add_argument("--skip-frontend-build", action="store_true")
    parser.add_argument("--output-dir", default=str(ARTIFACTS_DIR))
    return parser


def read_version() -> str:
    return VERSION_FILE.read_text(encoding="utf-8").strip()


def current_arch() -> str:
    machine = platform.machine().lower()
    if machine in {"arm64", "aarch64"}:
        return "arm64"
    if machine in {"x86_64", "amd64"}:
        return "x64"
    raise RuntimeError(f"unsupported build machine architecture: {machine}")


def run(command: list[str]) -> None:
    subprocess.run(command, cwd=REPO_ROOT, check=True)


def build_frontend(skip: bool) -> None:
    if not skip:
        run(["npm", "run", "build"])


def sync_versions() -> None:
    run([sys.executable, "scripts/sync_version.py", "--check"])


def build_bundle() -> Path:
    dist_dir = REPO_ROOT / "dist"
    build_dir = REPO_ROOT / "build"
    shutil.rmtree(dist_dir, ignore_errors=True)
    shutil.rmtree(build_dir, ignore_errors=True)
    run([sys.executable, "-m", "PyInstaller", "--noconfirm", str(SPEC_FILE)])
    bundle_dir = dist_dir / "skill-manager"
    binary = bundle_dir / "skill-manager"
    if not binary.exists():
        raise RuntimeError("PyInstaller did not produce dist/skill-manager/skill-manager")
    return bundle_dir


def write_checksum(path: Path) -> Path:
    digest = sha256(path.read_bytes()).hexdigest()
    checksum_path = Path(f"{path}.sha256")
    checksum_path.write_text(f"{digest}  {path.name}\n", encoding="utf-8")
    return checksum_path


def package_artifact(bundle_dir: Path, output_dir: Path, version: str) -> tuple[Path, Path]:
    artifact_name = f"skill-manager-v{version}-darwin-{current_arch()}.tar.gz"
    output_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = output_dir / artifact_name
    with tarfile.open(artifact_path, "w:gz") as archive:
        archive.add(bundle_dir, arcname="skill-manager")
    checksum_path = write_checksum(artifact_path)
    return artifact_path, checksum_path


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    version = read_version()
    build_frontend(args.skip_frontend_build)
    sync_versions()
    bundle_dir = build_bundle()
    artifact, checksum = package_artifact(bundle_dir, Path(args.output_dir), version)
    print(artifact)
    print(checksum)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
