#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from tests.support.marketplace_https_fixture import serve_fixture_forever


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve the local HTTPS marketplace fixture until terminated.")
    parser.add_argument("--manifest", required=True, help="Path to the JSON manifest to write once the server is ready.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    serve_fixture_forever(manifest_path=Path(args.manifest).resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
