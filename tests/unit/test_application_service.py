from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from skill_manager.application import ApplicationService
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
    def test_list_catalog_collapses_identical_content_and_preserves_builtins(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            runner = seed_mixed_fixture(spec)
            service = ApplicationService.from_environment(spec.env(), command_runner=runner)
            catalog = service.list_catalog()

            trace_lens = next(entry for entry in catalog if entry["declaredName"] == "Trace Lens")
            self.assertEqual(trace_lens["ownership"], "unmanaged")
            self.assertEqual(len(trace_lens["harnesses"]), 2)
            self.assertEqual(trace_lens["conflicts"], [])

            builtin = next(entry for entry in catalog if entry["ownership"] == "builtin" and entry["declaredName"] == "Scout")
            self.assertEqual(builtin["builtinHarnesses"], ["gemini"])

    def test_list_catalog_surfaces_divergent_source_backed_copies_as_conflicts(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            service = ApplicationService.from_environment(
                spec.env(),
                command_runner=seed_divergent_source_fixture(spec),
            )

            catalog = service.list_catalog()
            policy_kit = next(entry for entry in catalog if entry["declaredName"] == "Policy Kit")

            self.assertEqual(policy_kit["ownership"], "unmanaged")
            self.assertEqual(len(policy_kit["harnesses"]), 2)
            self.assertEqual(len(policy_kit["conflicts"]), 1)
            self.assertEqual(policy_kit["conflicts"][0]["conflictType"], "divergent_revision")

    def test_shared_and_unmanaged_entries_stay_separate_even_with_matching_source_identity(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            seed_skill_package(
                spec.shared_store_root,
                "policy-kit",
                "Policy Kit",
                body="shared canonical copy",
            )
            seed_store_manifest(
                spec,
                [
                    ManifestEntry(
                        package_dir="policy-kit",
                        declared_name="Policy Kit",
                        source_kind="github",
                        source_locator="github:mode-io/policy-kit",
                        revision="bootstrap",
                    )
                ],
            )
            seed_skill_package(
                spec.home / ".codex" / "skills",
                "policy-kit-local",
                "Policy Kit",
                body="local harness copy",
                source_kind="github",
                source_locator="github:mode-io/policy-kit",
            )

            service = ApplicationService.from_environment(spec.env(), command_runner=StubCommandRunner())
            catalog = [entry for entry in service.list_catalog() if entry["declaredName"] == "Policy Kit"]

            self.assertEqual(len(catalog), 2)
            self.assertEqual({entry["ownership"] for entry in catalog}, {"shared", "unmanaged"})

    def test_run_check_surfaces_broken_shared_directory(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            runner = seed_mixed_fixture(spec)
            service = ApplicationService.from_environment(spec.env(), command_runner=runner)
            report = service.run_check()
            self.assertEqual(report["status"], "error")
            self.assertEqual(report["counts"]["errors"], 1)


if __name__ == "__main__":
    unittest.main()
