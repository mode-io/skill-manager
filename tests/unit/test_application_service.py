from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from skill_manager.application import ApplicationService
from skill_manager.domain import fingerprint_package
from skill_manager.store import ManifestEntry

from tests.support import (
    StubCommandRunner,
    create_fake_home_spec,
    seed_divergent_source_fixture,
    seed_mixed_fixture,
    seed_skill_package,
    seed_store_manifest,
)


class ApplicationServiceTests(unittest.TestCase):
    def test_list_skills_groups_identical_local_copies_and_preserves_builtins(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            runner = seed_mixed_fixture(spec)
            service = ApplicationService.from_environment(spec.env(), command_runner=runner)
            payload = service.list_skills()

            trace_lens = next(row for row in payload["rows"] if row["name"] == "Trace Lens")
            self.assertEqual(trace_lens["displayStatus"], "Found locally")
            self.assertTrue(trace_lens["needsAttention"])
            self.assertEqual(trace_lens["defaultSortRank"], 1)
            self.assertEqual(
                {cell["harness"] for cell in trace_lens["cells"] if cell["state"] == "found"},
                {"codex", "claude"},
            )

            scout = next(row for row in payload["rows"] if row["name"] == "Scout")
            self.assertEqual(scout["displayStatus"], "Built-in")
            self.assertFalse(scout["needsAttention"])
            self.assertEqual(scout["defaultSortRank"], 3)
            self.assertNotIn("isBuiltin", trace_lens)

    def test_list_skills_marks_shared_store_modifications_as_custom(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            package_root = seed_skill_package(
                spec.shared_store_root,
                "audit-skill",
                "Audit Skill",
                body="current managed version",
                source_kind="github",
                source_locator="github:mode-io/audit-skill",
            )
            current_revision, _ = fingerprint_package(package_root)
            seed_store_manifest(
                spec,
                [
                    ManifestEntry(
                        package_dir="audit-skill",
                        declared_name="Audit Skill",
                        source_kind="github",
                        source_locator="github:mode-io/audit-skill",
                        revision=f"{current_revision}-old",
                    )
                ],
            )

            service = ApplicationService.from_environment(spec.env(), command_runner=StubCommandRunner())
            payload = service.list_skills()
            audit = next(row for row in payload["rows"] if row["name"] == "Audit Skill")

            self.assertEqual(audit["displayStatus"], "Custom")
            self.assertEqual(audit["attentionMessage"], "Modified locally; source updates are disabled.")
            self.assertTrue(audit["needsAttention"])
            self.assertEqual(audit["defaultSortRank"], 0)

    def test_divergent_source_backed_local_copies_become_separate_found_rows(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            service = ApplicationService.from_environment(
                spec.env(),
                command_runner=seed_divergent_source_fixture(spec),
            )

            payload = service.list_skills()
            policy_rows = [row for row in payload["rows"] if row["name"] == "Policy Kit"]

            self.assertEqual(len(policy_rows), 2)
            self.assertTrue(all(row["displayStatus"] == "Found locally" for row in policy_rows))

    def test_settings_surface_store_issues(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            runner = seed_mixed_fixture(spec)
            service = ApplicationService.from_environment(spec.env(), command_runner=runner)

            settings = service.settings()

            self.assertEqual(len(settings["harnesses"]), 6)
            self.assertEqual(len(settings["storeIssues"]), 1)


if __name__ == "__main__":
    unittest.main()
