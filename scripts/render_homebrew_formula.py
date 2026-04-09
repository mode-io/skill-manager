#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = REPO_ROOT / "packaging" / "homebrew" / "skill-manager.rb.tmpl"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Render the Homebrew formula from the template.")
    parser.add_argument("--version", required=True)
    parser.add_argument("--arm64-url", required=True)
    parser.add_argument("--arm64-sha256", required=True)
    parser.add_argument("--x64-url", required=True)
    parser.add_argument("--x64-sha256", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args(argv)

    content = TEMPLATE.read_text(encoding="utf-8")
    content = content.replace("__VERSION__", args.version)
    content = content.replace("__ARM64_URL__", args.arm64_url)
    content = content.replace("__ARM64_SHA256__", args.arm64_sha256)
    content = content.replace("__X64_URL__", args.x64_url)
    content = content.replace("__X64_SHA256__", args.x64_sha256)
    Path(args.output).write_text(content, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
