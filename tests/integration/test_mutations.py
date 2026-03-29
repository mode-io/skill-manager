from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from skill_manager.domain import fingerprint_package
from skill_manager.store import ManifestEntry

from tests.support import AppTestHarness, StubCommandRunner, seed_mixed_fixture, seed_shared_only_fixture, seed_skill_package, seed_store_manifest


class MutationTests(unittest.TestCase):
    def test_enable_managed_skill_creates_symlink(self) -> None:
        with AppTestHarness(fixture_factory=seed_shared_only_fixture) as harness:
            skills = harness.get_json("/api/skills")
            shared_entry = next(row for row in skills["rows"] if row["name"] == "Shared Audit")

            result = harness.post_json(f"/api/skills/{shared_entry['skillRef']}/enable", {"harness": "codex"})

            self.assertTrue(result["ok"])
            self.assertTrue((harness.spec.home / ".codex" / "skills" / "shared-audit").is_symlink())

    def test_disable_managed_skill_removes_symlink(self) -> None:
        with AppTestHarness(fixture_factory=seed_shared_only_fixture) as harness:
            skills = harness.get_json("/api/skills")
            shared_entry = next(row for row in skills["rows"] if row["name"] == "Shared Audit")
            harness.post_json(f"/api/skills/{shared_entry['skillRef']}/enable", {"harness": "codex"})

            result = harness.post_json(f"/api/skills/{shared_entry['skillRef']}/disable", {"harness": "codex"})

            self.assertTrue(result["ok"])
            self.assertFalse((harness.spec.home / ".codex" / "skills" / "shared-audit").exists())

    def test_manage_skill_replaces_found_local_copy_with_managed_links(self) -> None:
        with AppTestHarness(mixed=True) as harness:
            skills = harness.get_json("/api/skills")
            trace_lens = next(row for row in skills["rows"] if row["name"] == "Trace Lens")

            result = harness.post_json(f"/api/skills/{trace_lens['skillRef']}/manage")
            refreshed = harness.get_json("/api/skills")

            self.assertTrue(result["ok"])
            managed_trace = next(row for row in refreshed["rows"] if row["name"] == "Trace Lens")
            self.assertEqual(managed_trace["displayStatus"], "Managed")
            self.assertTrue((harness.spec.home / ".codex" / "skills" / "trace-lens").is_symlink())
            self.assertTrue((harness.spec.home / ".claude" / "skills" / "trace-lens-copy").is_symlink())

    def test_manage_all_skills_centralizes_all_found_local_rows(self) -> None:
        with AppTestHarness(mixed=True) as harness:
            result = harness.post_json("/api/skills/manage-all")
            refreshed = harness.get_json("/api/skills")

            self.assertTrue(result["ok"])
            self.assertGreater(result["managedCount"], 0)
            self.assertEqual(result["failures"], [])
            self.assertEqual(refreshed["summary"]["unmanaged"], 0)

    def test_manage_unknown_skill_returns_404(self) -> None:
        with AppTestHarness() as harness:
            result = harness.post_json("/api/skills/missing-ref/manage", expected_status=404)
            self.assertIn("unknown skill ref", result["error"])

    def test_update_refuses_custom_skill(self) -> None:
        def seed_custom_fixture(spec):
            package_root = seed_skill_package(
                spec.shared_store_root,
                "audit-skill",
                "Audit Skill",
                body="customized version",
                source_kind="github",
                source_locator="github:mode-io/audit-skill",
            )
            revision, _ = fingerprint_package(package_root)
            seed_store_manifest(
                spec,
                [
                    ManifestEntry(
                        package_dir="audit-skill",
                        declared_name="Audit Skill",
                        source_kind="github",
                        source_locator="github:mode-io/audit-skill",
                        revision=f"{revision}-recorded",
                    )
                ],
            )
            return StubCommandRunner()

        with AppTestHarness(fixture_factory=seed_custom_fixture) as harness:
            skills = harness.get_json("/api/skills")
            audit = next(row for row in skills["rows"] if row["name"] == "Audit Skill")
            result = harness.post_json(f"/api/skills/{audit['skillRef']}/update", expected_status=400)

            self.assertIn("cannot be updated", result["error"])


if __name__ == "__main__":
    unittest.main()
