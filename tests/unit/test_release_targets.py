from __future__ import annotations

import unittest

from scripts.release_targets import artifact_name, resolve_current_target, target_by_id


class ReleaseTargetTests(unittest.TestCase):
    def test_resolves_darwin_arm64_aliases(self) -> None:
        target = resolve_current_target(system="darwin", machine="aarch64")

        self.assertEqual(target.id, "darwin-arm64")
        self.assertEqual(artifact_name("1.2.3", target), "skill-manager-v1.2.3-darwin-arm64.tar.gz")

    def test_resolves_darwin_x64_aliases(self) -> None:
        target = resolve_current_target(system="darwin", machine="x86_64")

        self.assertEqual(target.id, "darwin-x64")

    def test_resolves_linux_x64_aliases(self) -> None:
        target = resolve_current_target(system="linux", machine="amd64")

        self.assertEqual(target.id, "linux-x64")

    def test_resolves_linux_arm64_aliases(self) -> None:
        target = resolve_current_target(system="linux", machine="aarch64")

        self.assertEqual(target.id, "linux-arm64")
        self.assertEqual(artifact_name("1.2.3", target), "skill-manager-v1.2.3-linux-arm64.tar.gz")

    def test_target_by_id_returns_configured_target(self) -> None:
        self.assertEqual(target_by_id("linux-x64").node_platform, "linux")


if __name__ == "__main__":
    unittest.main()
