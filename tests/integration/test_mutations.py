from __future__ import annotations

from tempfile import TemporaryDirectory
import unittest

from skill_manager.domain import fingerprint_package
from skill_manager.store import ManifestEntry

from tests.support.app_harness import AppTestHarness
from tests.support.fake_home import seed_mixed_fixture, seed_shared_only_fixture, seed_skill_package, seed_store_manifest


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


def seed_delete_fixture(spec):
    seed_shared_only_fixture(spec)
    target = spec.shared_store_root / "shared-audit"
    for path in (
        spec.codex_root / "shared-audit",
        spec.claude_root / "shared-audit",
        spec.opencode_root / "shared-audit",
        spec.openclaw_managed_root / "shared-audit",
    ):
        path.symlink_to(target)


def seed_delete_preflight_failure_fixture(spec):
    seed_shared_only_fixture(spec)
    target = spec.shared_store_root / "shared-audit"
    (spec.codex_root / "shared-audit").symlink_to(target)
    seed_skill_package(spec.claude_root, "shared-audit", "Shared Audit", body="local conflict")


def seed_unmanage_fixture(spec):
    seed_shared_only_fixture(spec)
    target = spec.shared_store_root / "shared-audit"
    for path in (
        spec.codex_root / "shared-audit",
        spec.claude_root / "shared-audit",
    ):
        path.symlink_to(target)


class MutationTests(unittest.TestCase):
    def test_enable_managed_skill_creates_symlink(self) -> None:
        with AppTestHarness(fixture_factory=seed_shared_only_fixture) as harness:
            skills = harness.get_json("/api/skills")
            shared_entry = next(row for row in skills["rows"] if row["name"] == "Shared Audit")

            result = harness.post_json(f"/api/skills/{shared_entry['skillRef']}/enable", {"harness": "codex"})

            self.assertTrue(result["ok"])
            self.assertTrue((harness.spec.codex_root / "shared-audit").is_symlink())

    def test_disable_managed_skill_removes_symlink(self) -> None:
        with AppTestHarness(fixture_factory=seed_shared_only_fixture) as harness:
            skills = harness.get_json("/api/skills")
            shared_entry = next(row for row in skills["rows"] if row["name"] == "Shared Audit")
            harness.post_json(f"/api/skills/{shared_entry['skillRef']}/enable", {"harness": "codex"})

            result = harness.post_json(f"/api/skills/{shared_entry['skillRef']}/disable", {"harness": "codex"})

            self.assertTrue(result["ok"])
            self.assertFalse((harness.spec.codex_root / "shared-audit").exists())

    def test_manage_skill_replaces_found_local_copy_with_managed_links(self) -> None:
        with AppTestHarness(mixed=True) as harness:
            skills = harness.get_json("/api/skills")
            trace_lens = next(row for row in skills["rows"] if row["name"] == "Trace Lens")

            result = harness.post_json(f"/api/skills/{trace_lens['skillRef']}/manage")
            refreshed = harness.get_json("/api/skills")

            self.assertTrue(result["ok"])
            managed_trace = next(row for row in refreshed["rows"] if row["name"] == "Trace Lens")
            self.assertEqual(managed_trace["displayStatus"], "Managed")
            self.assertTrue((harness.spec.codex_root / "trace-lens").is_symlink())
            self.assertTrue((harness.spec.claude_root / "trace-lens-copy").is_symlink())
            self.assertTrue((harness.spec.opencode_root / "trace-lens").is_symlink())
            self.assertTrue((harness.spec.codex_legacy_root / "trace-lens").is_dir())
            self.assertFalse((harness.spec.codex_legacy_root / "trace-lens").is_symlink())

    def test_manage_all_skills_centralizes_all_found_local_rows(self) -> None:
        with AppTestHarness(mixed=True) as harness:
            result = harness.post_json("/api/skills/manage-all")
            refreshed = harness.get_json("/api/skills")

            self.assertTrue(result["ok"])
            self.assertGreater(result["managedCount"], 0)
            self.assertEqual(result["failures"], [])
            self.assertEqual(refreshed["summary"]["unmanaged"], 0)

    def test_manage_rejects_missing_harness_install_before_creating_bindings(self) -> None:
        with AppTestHarness(mixed=True) as harness:
            (harness.spec.bin_dir / "codex").unlink()
            skills = harness.get_json("/api/skills")
            trace_lens = next(row for row in skills["rows"] if row["name"] == "Trace Lens")

            result = harness.post_json(f"/api/skills/{trace_lens['skillRef']}/manage", expected_status=400)

            self.assertIn("Codex is not installed or not available on PATH", result["error"])
            self.assertFalse((harness.spec.codex_root / "trace-lens").exists())
            self.assertFalse((harness.spec.claude_root / "trace-lens-copy").is_symlink())
            self.assertFalse((harness.spec.opencode_root / "trace-lens").exists())

    def test_manage_unknown_skill_returns_404(self) -> None:
        with AppTestHarness() as harness:
            result = harness.post_json("/api/skills/missing-ref/manage", expected_status=404)
            self.assertIn("unknown skill ref", result["error"])

    def test_update_refuses_custom_skill(self) -> None:
        with AppTestHarness(fixture_factory=seed_custom_fixture) as harness:
            skills = harness.get_json("/api/skills")
            audit = next(row for row in skills["rows"] if row["name"] == "Audit Skill")
            result = harness.post_json(f"/api/skills/{audit['skillRef']}/update", expected_status=400)

            self.assertIn("cannot be updated", result["error"])

    def test_unmanage_restores_real_local_copies_for_currently_enabled_harnesses(self) -> None:
        with AppTestHarness(fixture_factory=seed_unmanage_fixture) as harness:
            skills = harness.get_json("/api/skills")
            shared_entry = next(row for row in skills["rows"] if row["name"] == "Shared Audit")

            result = harness.post_json(f"/api/skills/{shared_entry['skillRef']}/unmanage")

            self.assertTrue(result["ok"])
            self.assertFalse((harness.spec.shared_store_root / "shared-audit").exists())
            self.assertTrue((harness.spec.codex_root / "shared-audit").is_dir())
            self.assertFalse((harness.spec.codex_root / "shared-audit").is_symlink())
            self.assertTrue((harness.spec.claude_root / "shared-audit").is_dir())
            self.assertFalse((harness.spec.claude_root / "shared-audit").is_symlink())
            self.assertFalse((harness.spec.cursor_root / "shared-audit").exists())

            refreshed = harness.get_json("/api/skills")
            restored = [row for row in refreshed["rows"] if row["name"] == "Shared Audit"]
            self.assertEqual(len(restored), 1)
            self.assertEqual(restored[0]["displayStatus"], "Unmanaged")

    def test_unmanage_rejects_skills_with_no_enabled_harnesses(self) -> None:
        with AppTestHarness(fixture_factory=seed_shared_only_fixture) as harness:
            skills = harness.get_json("/api/skills")
            shared_entry = next(row for row in skills["rows"] if row["name"] == "Shared Audit")

            result = harness.post_json(f"/api/skills/{shared_entry['skillRef']}/unmanage", expected_status=400)

            self.assertIn("turn on at least one harness", result["error"])
            self.assertTrue((harness.spec.shared_store_root / "shared-audit").is_dir())

    def test_unmanage_refuses_to_touch_disabled_harness_bindings(self) -> None:
        with AppTestHarness(fixture_factory=seed_unmanage_fixture) as harness:
            skills = harness.get_json("/api/skills")
            shared_entry = next(row for row in skills["rows"] if row["name"] == "Shared Audit")
            harness.put_json("/api/settings/harnesses/codex/support", {"enabled": False})

            result = harness.post_json(f"/api/skills/{shared_entry['skillRef']}/unmanage", expected_status=409)

            self.assertIn("disabled harnesses still have bindings", result["error"])
            self.assertTrue((harness.spec.codex_root / "shared-audit").is_symlink())
            self.assertTrue((harness.spec.shared_store_root / "shared-audit").is_dir())

    def test_unmanage_rejects_unmanaged_and_builtin_skills(self) -> None:
        with AppTestHarness(mixed=True) as harness:
            skills = harness.get_json("/api/skills")
            unmanaged = next(row for row in skills["rows"] if row["name"] == "Trace Lens")
            builtin = next(row for row in skills["rows"] if row["name"] == "Review Helper")

            unmanaged_result = harness.post_json(f"/api/skills/{unmanaged['skillRef']}/unmanage", expected_status=400)
            builtin_result = harness.post_json(f"/api/skills/{builtin['skillRef']}/unmanage", expected_status=400)

            self.assertIn("only managed or custom", unmanaged_result["error"])
            self.assertIn("only managed or custom", builtin_result["error"])

    def test_delete_managed_skill_removes_shared_package_and_all_links(self) -> None:
        with AppTestHarness(fixture_factory=seed_delete_fixture) as harness:
            skills = harness.get_json("/api/skills")
            shared_entry = next(row for row in skills["rows"] if row["name"] == "Shared Audit")

            result = harness.post_json(f"/api/skills/{shared_entry['skillRef']}/delete")

            self.assertTrue(result["ok"])
            self.assertFalse((harness.spec.shared_store_root / "shared-audit").exists())
            self.assertFalse((harness.spec.codex_root / "shared-audit").exists())
            self.assertFalse((harness.spec.claude_root / "shared-audit").exists())
            self.assertFalse((harness.spec.opencode_root / "shared-audit").exists())
            self.assertFalse((harness.spec.openclaw_managed_root / "shared-audit").exists())

            refreshed = harness.get_json("/api/skills")
            self.assertNotIn(shared_entry["skillRef"], [row["skillRef"] for row in refreshed["rows"]])

    def test_delete_custom_skill_is_allowed(self) -> None:
        with AppTestHarness(fixture_factory=seed_custom_fixture) as harness:
            skills = harness.get_json("/api/skills")
            audit = next(row for row in skills["rows"] if row["name"] == "Audit Skill")

            result = harness.post_json(f"/api/skills/{audit['skillRef']}/delete")

            self.assertTrue(result["ok"])
            self.assertFalse((harness.spec.shared_store_root / "audit-skill").exists())

    def test_delete_rejects_unmanaged_and_builtin_skills(self) -> None:
        with AppTestHarness(mixed=True) as harness:
            skills = harness.get_json("/api/skills")
            unmanaged = next(row for row in skills["rows"] if row["name"] == "Trace Lens")
            builtin = next(row for row in skills["rows"] if row["name"] == "Review Helper")

            unmanaged_result = harness.post_json(f"/api/skills/{unmanaged['skillRef']}/delete", expected_status=400)
            builtin_result = harness.post_json(f"/api/skills/{builtin['skillRef']}/delete", expected_status=400)

            self.assertIn("only managed or custom", unmanaged_result["error"])
            self.assertIn("only managed or custom", builtin_result["error"])

    def test_delete_refuses_to_touch_disabled_harness_bindings(self) -> None:
        with AppTestHarness(fixture_factory=seed_delete_fixture) as harness:
            skills = harness.get_json("/api/skills")
            shared_entry = next(row for row in skills["rows"] if row["name"] == "Shared Audit")
            harness.put_json("/api/settings/harnesses/openclaw/support", {"enabled": False})

            result = harness.post_json(f"/api/skills/{shared_entry['skillRef']}/delete", expected_status=409)

            self.assertIn("disabled harnesses still have bindings", result["error"])
            self.assertTrue((harness.spec.shared_store_root / "shared-audit").is_dir())
            self.assertTrue((harness.spec.openclaw_managed_root / "shared-audit").exists())

    def test_delete_aborts_before_mutation_when_any_target_is_real_directory(self) -> None:
        with AppTestHarness(fixture_factory=seed_delete_preflight_failure_fixture) as harness:
            skills = harness.get_json("/api/skills")
            shared_entry = next(row for row in skills["rows"] if row["name"] == "Shared Audit")

            result = harness.post_json(f"/api/skills/{shared_entry['skillRef']}/delete", expected_status=409)

            self.assertIn("not a symlink", result["error"])
            self.assertTrue((harness.spec.shared_store_root / "shared-audit").is_dir())
            self.assertTrue((harness.spec.codex_root / "shared-audit").is_symlink())
            self.assertTrue((harness.spec.claude_root / "shared-audit").is_dir())


if __name__ == "__main__":
    unittest.main()
