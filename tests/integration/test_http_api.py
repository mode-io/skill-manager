from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import urlopen

from tests.support.app_harness import AppTestHarness
from tests.support.fake_home import seed_divergent_source_fixture, seed_managed_linked_fixture


class HttpApiTests(unittest.TestCase):
    def test_empty_fixture_returns_skills_settings_and_health(self) -> None:
        with AppTestHarness() as harness:
            health = harness.get_json("/api/health")
            skills = harness.get_json("/api/skills")
            settings = harness.get_json("/api/settings")

            self.assertTrue(health["ok"])
            self.assertEqual(skills["summary"]["managed"], 0)
            self.assertEqual(skills["rows"], [])
            self.assertEqual(len(settings["harnesses"]), 5)
            openclaw = next(item for item in settings["harnesses"] if item["harness"] == "openclaw")
            self.assertTrue(openclaw["detected"])
            self.assertTrue(openclaw["supportEnabled"])
            self.assertEqual(openclaw["managedLocation"], str(harness.spec.home / ".openclaw" / "skills"))
            self.assertNotIn("discoveryMode", openclaw)
            self.assertNotIn("centralStore", settings)
            self.assertNotIn("topology", settings)

    def test_settings_support_toggle_hides_disabled_harness_from_skills_inventory(self) -> None:
        with AppTestHarness(mixed=True) as harness:
            settings = harness.get_json("/api/settings")
            codex = next(item for item in settings["harnesses"] if item["harness"] == "codex")

            self.assertTrue(codex["supportEnabled"])

            harness.put_json("/api/settings/harnesses/codex/support", {"enabled": False})

            updated_settings = harness.get_json("/api/settings")
            updated_codex = next(item for item in updated_settings["harnesses"] if item["harness"] == "codex")
            skills = harness.get_json("/api/skills")

            self.assertFalse(updated_codex["supportEnabled"])
            self.assertNotIn("codex", [column["harness"] for column in skills["harnessColumns"]])

    def test_mixed_fixture_returns_skills_page_and_detail(self) -> None:
        with AppTestHarness(mixed=True) as harness:
            skills = harness.get_json("/api/skills")

            shared_audit = next(row for row in skills["rows"] if row["name"] == "Shared Audit")
            detail = harness.get_json(f"/api/skills/{shared_audit['skillRef']}")
            source_status = harness.get_json(f"/api/skills/{shared_audit['skillRef']}/source-status")
            review_helper = next(row for row in skills["rows"] if row["name"] == "Review Helper")
            builtin_detail = harness.get_json(f"/api/skills/{review_helper['skillRef']}")
            builtin_source_status = harness.get_json(f"/api/skills/{review_helper['skillRef']}/source-status")

            self.assertEqual(shared_audit["displayStatus"], "Managed")
            self.assertNotIn("isBuiltin", shared_audit)
            self.assertEqual(detail["displayStatus"], "Managed")
            self.assertEqual(
                [cell["label"] for cell in detail["harnessCells"]],
                ["Codex", "Claude", "Cursor", "OpenCode", "OpenClaw"],
            )
            self.assertNotIn("updateStatus", detail["actions"])
            self.assertEqual(source_status["updateStatus"], "no_update_available")
            self.assertEqual(detail["actions"]["stopManagingStatus"], "disabled_no_enabled")
            self.assertEqual(detail["actions"]["stopManagingHarnessLabels"], [])
            self.assertTrue(detail["actions"]["canDelete"])
            self.assertEqual(detail["actions"]["deleteHarnessLabels"], [])
            self.assertIn("Shared package fixture.", detail["documentMarkdown"])
            self.assertNotIn("statusMessage", detail)
            self.assertNotIn("source", detail)
            self.assertNotIn("advanced", detail)
            self.assertEqual(detail["sourceLinks"], {
                "repoLabel": "mode-io/shared-audit",
                "repoUrl": "https://github.com/mode-io/shared-audit",
                "folderUrl": None,
            })
            self.assertFalse(builtin_detail["actions"]["canDelete"])
            self.assertIsNone(builtin_source_status["updateStatus"])
            self.assertIsNone(builtin_detail["actions"]["stopManagingStatus"])
            self.assertEqual(builtin_detail["actions"]["stopManagingHarnessLabels"], [])
            self.assertEqual(builtin_detail["actions"]["deleteHarnessLabels"], [])
            self.assertEqual(
                builtin_detail["harnessCells"],
                [
                    {"harness": "codex", "label": "Codex", "logoKey": "codex", "state": "empty", "interactive": False},
                    {"harness": "claude", "label": "Claude", "logoKey": "claude", "state": "empty", "interactive": False},
                    {"harness": "cursor", "label": "Cursor", "logoKey": "cursor", "state": "empty", "interactive": False},
                    {"harness": "opencode", "label": "OpenCode", "logoKey": "opencode", "state": "builtin", "interactive": False},
                    {"harness": "openclaw", "label": "OpenClaw", "logoKey": "openclaw", "state": "empty", "interactive": False},
                ],
            )
            self.assertIsNone(builtin_detail["documentMarkdown"])
            self.assertNotIn("advanced", builtin_detail)
            self.assertIsNone(builtin_detail["sourceLinks"])

    def test_managed_detail_returns_shared_store_location_before_tool_links(self) -> None:
        with AppTestHarness(fixture_factory=seed_managed_linked_fixture) as harness:
            skills = harness.get_json("/api/skills")
            shared_audit = next(row for row in skills["rows"] if row["name"] == "Shared Audit")
            detail = harness.get_json(f"/api/skills/{shared_audit['skillRef']}")

            self.assertEqual([location["label"] for location in detail["locations"]], ["Shared Store", "Codex"])
            self.assertEqual(detail["actions"]["stopManagingStatus"], "available")
            self.assertEqual(detail["actions"]["stopManagingHarnessLabels"], ["Codex"])
            self.assertEqual(detail["actions"]["deleteHarnessLabels"], ["Codex"])

    def test_divergent_source_fixture_returns_separate_found_rows(self) -> None:
        with AppTestHarness(fixture_factory=seed_divergent_source_fixture) as harness:
            skills = harness.get_json("/api/skills")
            policy_rows = [row for row in skills["rows"] if row["name"] == "Policy Kit"]

            self.assertEqual(len(policy_rows), 2)
            self.assertTrue(all(row["displayStatus"] == "Unmanaged" for row in policy_rows))

    def test_unknown_skill_detail_returns_404_payload(self) -> None:
        with AppTestHarness() as harness:
            payload = harness.get_json("/api/skills/missing-entry", expected_status=404)
            self.assertIn("unknown skill ref", payload["error"])

    def test_frontend_routes_return_spa_shell_when_dist_is_present(self) -> None:
        with TemporaryDirectory(prefix="skill-manager-dist-") as tempdir:
            dist = Path(tempdir)
            (dist / "index.html").write_text("<!doctype html><html><body><div id='root'>skill-manager</div></body></html>", encoding="utf-8")

            with AppTestHarness(frontend_dist=dist) as harness:
                for path in ("/", "/skills", "/skills/managed", "/skills/unmanaged", "/marketplace", "/settings"):
                    with urlopen(f"{harness.base_url}{path}") as response:
                        body = response.read().decode("utf-8")
                    self.assertEqual(response.status, 200)
                    self.assertIn("<div id='root'>skill-manager</div>", body)


if __name__ == "__main__":
    unittest.main()
