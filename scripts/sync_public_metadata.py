#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
import sys


REPO_ROOT = Path(__file__).resolve().parents[1]
ROOT_LICENSE = REPO_ROOT / "LICENSE"
NPM_LICENSE = REPO_ROOT / "packaging" / "npm" / "LICENSE"


def sync_file(source: Path, target: Path, *, write: bool) -> bool:
    source_text = source.read_text(encoding="utf-8")
    current_text = target.read_text(encoding="utf-8") if target.exists() else None
    if current_text == source_text:
        return True
    if not write:
        print(f"{target}: expected contents synced from {source}", file=sys.stderr)
        return False
    target.write_text(source_text, encoding="utf-8")
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Sync public packaging metadata from the repo source of truth.")
    parser.add_argument("--check", action="store_true", help="Validate synced public metadata without modifying files.")
    parser.add_argument("--write", action="store_true", help="Rewrite synced public metadata files.")
    args = parser.parse_args(argv)

    if args.check == args.write:
        parser.error("choose exactly one of --check or --write")
    if not ROOT_LICENSE.exists():
        raise FileNotFoundError(f"missing root license file: {ROOT_LICENSE}")

    ok = sync_file(ROOT_LICENSE, NPM_LICENSE, write=args.write)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
