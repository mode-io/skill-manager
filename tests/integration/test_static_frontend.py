from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import urlopen

from tests.support.app_harness import AppTestHarness


def build_dist(root: Path) -> Path:
    dist = root / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<html><body>spa-shell</body></html>", encoding="utf-8")
    (dist / "assets" / "app.js").write_text("console.log('bundle');", encoding="utf-8")
    return dist


class StaticFrontendTests(unittest.TestCase):
    def test_serves_index_and_assets_within_dist(self) -> None:
        with TemporaryDirectory(prefix="skill-manager-static-") as temp_dir:
            dist = build_dist(Path(temp_dir))
            with AppTestHarness(frontend_dist=dist) as harness:
                index = urlopen(f"{harness.base_url}/").read().decode("utf-8")
                asset = urlopen(f"{harness.base_url}/assets/app.js").read().decode("utf-8")
                self.assertIn("spa-shell", index)
                self.assertIn("bundle", asset)

    def test_path_traversal_into_dist_sibling_is_not_served(self) -> None:
        """Regression: a sibling whose name extends ``dist`` passed the old startswith check."""
        with TemporaryDirectory(prefix="skill-manager-static-") as temp_dir:
            root = Path(temp_dir)
            dist = build_dist(root)
            secret_dir = root / "dist-secret"
            secret_dir.mkdir()
            (secret_dir / "secret.txt").write_text("TOP-SECRET", encoding="utf-8")

            with AppTestHarness(frontend_dist=dist) as harness:
                for path in ("/../dist-secret/secret.txt", "/%2e%2e/dist-secret/secret.txt"):
                    with self.subTest(path=path):
                        body = urlopen(f"{harness.base_url}{path}").read().decode("utf-8")
                        self.assertNotIn("TOP-SECRET", body)
                        # Falls through to the SPA index, exactly like any unknown route.
                        self.assertIn("spa-shell", body)


if __name__ == "__main__":
    unittest.main()
