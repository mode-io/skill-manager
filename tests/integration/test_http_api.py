from __future__ import annotations

import unittest

from tests.support import AppTestHarness, seed_divergent_source_fixture


class HttpApiTests(unittest.TestCase):
    def test_empty_fixture_returns_skills_settings_and_health(self) -> None:
        with AppTestHarness() as harness:
            health = harness.get_json("/health")
            skills = harness.get_json("/skills")
            settings = harness.get_json("/settings")

            self.assertTrue(health["ok"])
            self.assertEqual(skills["summary"]["managed"], 0)
            self.assertEqual(skills["rows"], [])
            self.assertEqual(len(settings["harnesses"]), 6)

    def test_mixed_fixture_returns_skills_page_and_detail(self) -> None:
        with AppTestHarness(mixed=True) as harness:
            skills = harness.get_json("/skills")

            shared_audit = next(row for row in skills["rows"] if row["name"] == "Shared Audit")
            detail = harness.get_json(f"/skills/{shared_audit['skillRef']}")

            self.assertEqual(shared_audit["displayStatus"], "Managed")
            self.assertFalse(shared_audit["needsAttention"])
            self.assertEqual(shared_audit["defaultSortRank"], 2)
            self.assertNotIn("isBuiltin", shared_audit)
            self.assertEqual(detail["displayStatus"], "Managed")
            self.assertTrue(any(harness["harness"] == "codex" for harness in detail["harnesses"]))

    def test_divergent_source_fixture_returns_separate_found_rows(self) -> None:
        with AppTestHarness(fixture_factory=seed_divergent_source_fixture) as harness:
            skills = harness.get_json("/skills")
            policy_rows = [row for row in skills["rows"] if row["name"] == "Policy Kit"]

            self.assertEqual(len(policy_rows), 2)
            self.assertTrue(all(row["displayStatus"] == "Found locally" for row in policy_rows))

    def test_unknown_skill_detail_returns_404_payload(self) -> None:
        with AppTestHarness() as harness:
            payload = harness.get_json("/skills/missing-entry", expected_status=404)
            self.assertIn("unknown skill ref", payload["error"])


if __name__ == "__main__":
    unittest.main()
