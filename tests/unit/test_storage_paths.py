from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest import mock

from skill_manager.storage_paths import (
    canonical_marketplace_cache_root,
    canonical_shared_store_root,
    legacy_shared_store_root,
    resolve_shared_store_root,
)

from tests.support.fake_home import seed_skill_package


class SharedStorePathResolutionTests(unittest.TestCase):
    def test_prefers_legacy_store_when_canonical_location_is_uninitialized(self) -> None:
        with TemporaryDirectory() as temp_dir:
            home = Path(temp_dir) / "home"
            legacy_root = home / ".local" / "share" / "skill-manager" / "shared"
            legacy_root.mkdir(parents=True, exist_ok=True)
            seed_skill_package(legacy_root, "audit", "Audit")
            canonical_data_dir = home / "Library" / "Application Support" / "skill-manager"

            with mock.patch("skill_manager.storage_paths.app_data_dir", return_value=canonical_data_dir):
                resolved = resolve_shared_store_root({"HOME": str(home)})
                canonical_root = canonical_shared_store_root({"HOME": str(home)})

            self.assertEqual(resolved, legacy_root)
            self.assertEqual(canonical_root, canonical_data_dir / "shared")
            self.assertEqual(legacy_shared_store_root({"HOME": str(home)}), legacy_root)

    def test_prefers_initialized_canonical_store_over_legacy_store(self) -> None:
        with TemporaryDirectory() as temp_dir:
            home = Path(temp_dir) / "home"
            legacy_root = home / ".local" / "share" / "skill-manager" / "shared"
            legacy_root.mkdir(parents=True, exist_ok=True)
            seed_skill_package(legacy_root, "legacy-audit", "Legacy Audit")
            canonical_data_dir = home / "Library" / "Application Support" / "skill-manager"
            canonical_root = canonical_data_dir / "shared"
            canonical_root.mkdir(parents=True, exist_ok=True)
            seed_skill_package(canonical_root, "audit", "Audit")

            with mock.patch("skill_manager.storage_paths.app_data_dir", return_value=canonical_data_dir):
                resolved = resolve_shared_store_root({"HOME": str(home)})

            self.assertEqual(resolved, canonical_root)


class MarketplaceCachePathResolutionTests(unittest.TestCase):
    def test_marketplace_cache_uses_canonical_app_data_root_only(self) -> None:
        with TemporaryDirectory() as temp_dir:
            home = Path(temp_dir) / "home"
            canonical_data_dir = home / "Library" / "Application Support" / "skill-manager"
            old_cache_root = home / ".local" / "share" / "skill-manager" / "marketplace"
            old_cache_root.mkdir(parents=True, exist_ok=True)

            with mock.patch("skill_manager.storage_paths.app_data_dir", return_value=canonical_data_dir):
                resolved = canonical_marketplace_cache_root({"HOME": str(home)})

            self.assertEqual(resolved, canonical_data_dir / "marketplace")
            self.assertNotEqual(resolved, old_cache_root)


if __name__ == "__main__":
    unittest.main()
