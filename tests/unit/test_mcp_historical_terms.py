from __future__ import annotations

import subprocess
import unittest
from pathlib import Path


# docs/decisions.md is a prepend-only log; its historical entries predate the rename
# and must stay verbatim, so the guard skips it and covers every other tracked file.
EXCLUDED_PATHS = {Path("docs/decisions.md")}


class McpHistoricalTermsTests(unittest.TestCase):
    def test_mcp_historical_terms_do_not_reappear(self) -> None:
        repo_root = Path(__file__).resolve().parents[2]
        result = subprocess.run(
            ["git", "ls-files", "-z"],
            cwd=repo_root,
            check=True,
            capture_output=True,
        )
        tracked_paths = [Path(path) for path in result.stdout.decode().split("\0") if path]
        forbidden = [
            "smith" + "ery",
            "source" + "harness",
            "source" + "_" + "harness",
            "source" + " " + "harness",
            "deferred" + " install",
            "deferred" + " mcp",
            "registry" + " record",
            "source" + " installer",
        ]

        matches: list[str] = []
        for relative_path in tracked_paths:
            if relative_path in EXCLUDED_PATHS:
                continue
            path = repo_root / relative_path
            try:
                raw = path.read_bytes()
            except FileNotFoundError:
                continue
            if b"\0" in raw:
                continue
            try:
                text = raw.decode("utf-8")
            except UnicodeDecodeError:
                continue
            for line_number, line in enumerate(text.splitlines(), start=1):
                normalized = line.lower()
                if any(term in normalized for term in forbidden):
                    matches.append(f"{relative_path}:{line_number}: {line.strip()}")

        self.assertEqual(matches, [])


if __name__ == "__main__":
    unittest.main()
