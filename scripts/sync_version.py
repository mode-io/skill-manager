#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys


REPO_ROOT = Path(__file__).resolve().parents[1]
VERSION_FILE = REPO_ROOT / "skill_manager" / "VERSION"
ROOT_PACKAGE_JSON = REPO_ROOT / "package.json"
NPM_PACKAGE_JSON = REPO_ROOT / "packaging" / "npm" / "package.json"


def read_version() -> str:
    return VERSION_FILE.read_text(encoding="utf-8").strip()


def sync_json_version(path: Path, version: str, *, write: bool) -> bool:
    payload = json.loads(path.read_text(encoding="utf-8"))
    current = payload.get("version")
    if current == version:
        return True
    if not write:
        print(f"{path}: expected version {version}, found {current}", file=sys.stderr)
        return False
    payload["version"] = version
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Sync package versions from skill_manager/VERSION.")
    parser.add_argument("--check", action="store_true", help="Validate versions without modifying files.")
    parser.add_argument("--write", action="store_true", help="Rewrite version fields to match the source of truth.")
    args = parser.parse_args(argv)

    if args.check == args.write:
        parser.error("choose exactly one of --check or --write")

    version = read_version()
    ok = True
    for path in (ROOT_PACKAGE_JSON, NPM_PACKAGE_JSON):
        ok = sync_json_version(path, version, write=args.write) and ok
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
