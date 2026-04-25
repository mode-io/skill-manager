from __future__ import annotations

import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.application.skills.manifest import load_skill_store_manifest as load_manifest
from skill_manager.application.skills.store import SkillStore

from tests.support.fake_home import seed_skill_package


class SkillStoreConcurrentIngestTests(unittest.TestCase):
    def test_two_threads_ingesting_distinct_packages_persist_both_entries(self) -> None:
        for iteration in range(20):
            with TemporaryDirectory() as temp:
                store_root = Path(temp) / "shared"
                store = SkillStore(store_root)
                staging = Path(temp) / "staging"
                staging.mkdir()

                pkg_a = seed_skill_package(staging, "alpha", "Alpha")
                pkg_b = seed_skill_package(staging, "bravo", "Bravo")

                def ingest(source: Path) -> None:
                    store.ingest(
                        source_path=source,
                        declared_name=source.name,
                        source_kind="github",
                        source_locator=f"github:test/{source.name}",
                    )

                with ThreadPoolExecutor(max_workers=2) as pool:
                    futures = [pool.submit(ingest, pkg_a), pool.submit(ingest, pkg_b)]
                    for future in futures:
                        future.result()

                manifest = load_manifest(store.manifest_path)
                names = sorted(entry.package_dir for entry in manifest.entries)
                self.assertEqual(names, ["alpha", "bravo"], f"iteration {iteration} dropped entries")
                self.assertTrue((store_root / "alpha" / "SKILL.md").is_file())
                self.assertTrue((store_root / "bravo" / "SKILL.md").is_file())


if __name__ == "__main__":
    unittest.main()
