#!/usr/bin/env python3
"""Dump the FastAPI OpenAPI schema to frontend/src/api/openapi.json."""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from skill_manager.api.app import create_app  # noqa: E402
from skill_manager.application import build_backend_container  # noqa: E402
from skill_manager.application.marketplace import MarketplaceCatalog  # noqa: E402


def main() -> int:
    catalog = MarketplaceCatalog(warm_on_init=False)
    container = build_backend_container({}, marketplace_catalog=catalog)
    app = create_app(container)
    schema = app.openapi()
    output_path = Path(__file__).resolve().parent.parent / "frontend" / "src" / "api" / "openapi.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {output_path.relative_to(Path.cwd()) if output_path.is_relative_to(Path.cwd()) else output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
