#!/usr/bin/env python3
from __future__ import annotations

import argparse
from hashlib import sha256
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import zipfile

if __package__:
    from .release_targets import ReleaseTarget, artifact_name, resolve_current_target
else:
    from release_targets import ReleaseTarget, artifact_name, resolve_current_target


REPO_ROOT = Path(__file__).resolve().parents[1]
VERSION_FILE = REPO_ROOT / "skill_manager" / "VERSION"
SPEC_FILE = REPO_ROOT / "packaging" / "pyinstaller" / "skill-manager.spec"
ARTIFACTS_DIR = REPO_ROOT / ".artifacts" / "release"
LICENSE_FILE = REPO_ROOT / "LICENSE"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build a release artifact for skill-manager.")
    parser.add_argument("--skip-frontend-build", action="store_true")
    parser.add_argument("--output-dir", default=str(ARTIFACTS_DIR))
    return parser


def read_version() -> str:
    return VERSION_FILE.read_text(encoding="utf-8").strip()


def run(command: list[str]) -> None:
    subprocess.run(command, cwd=REPO_ROOT, check=True)


def resolve_executable(name: str) -> str:
    executable = shutil.which(name)
    if executable is None:
        raise FileNotFoundError(f"required executable was not found on PATH: {name}")
    return executable


def build_frontend(skip: bool) -> None:
    if not skip:
        run([resolve_executable("npm"), "run", "build"])


def sync_versions() -> None:
    run([sys.executable, "scripts/sync_version.py", "--check"])


def copy_license(bundle_dir: Path) -> None:
    if not LICENSE_FILE.exists():
        raise RuntimeError(f"missing repo license file: {LICENSE_FILE}")
    shutil.copy2(LICENSE_FILE, bundle_dir / "LICENSE")


def build_bundle(target: ReleaseTarget) -> Path:
    dist_dir = REPO_ROOT / "dist"
    build_dir = REPO_ROOT / "build"
    shutil.rmtree(dist_dir, ignore_errors=True)
    shutil.rmtree(build_dir, ignore_errors=True)
    run([sys.executable, "-m", "PyInstaller", "--noconfirm", str(SPEC_FILE)])
    bundle_dir = dist_dir / "skill-manager"
    binary = bundle_dir / target.executable_name
    if not binary.exists():
        raise RuntimeError(
            f"PyInstaller did not produce dist/skill-manager/{target.executable_name}"
        )
    copy_license(bundle_dir)
    return bundle_dir


def write_checksum(path: Path) -> Path:
    digest = sha256(path.read_bytes()).hexdigest()
    checksum_path = Path(f"{path}.sha256")
    checksum_path.write_text(f"{digest}  {path.name}\n", encoding="utf-8")
    return checksum_path


def package_artifact(
    bundle_dir: Path,
    output_dir: Path,
    version: str,
    target: ReleaseTarget,
) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = output_dir / artifact_name(version, target)
    if target.archive_format == "zip":
        with zipfile.ZipFile(artifact_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(bundle_dir.rglob("*")):
                archive.write(path, Path("skill-manager") / path.relative_to(bundle_dir))
    elif target.archive_format == "tar.gz":
        with tarfile.open(artifact_path, "w:gz") as archive:
            archive.add(bundle_dir, arcname="skill-manager")
    else:
        raise RuntimeError(f"unsupported archive format: {target.archive_format}")
    checksum_path = write_checksum(artifact_path)
    return artifact_path, checksum_path


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    version = read_version()
    target = resolve_current_target()
    build_frontend(args.skip_frontend_build)
    sync_versions()
    bundle_dir = build_bundle(target)
    artifact, checksum = package_artifact(bundle_dir, Path(args.output_dir), version, target)
    print(artifact)
    print(checksum)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
