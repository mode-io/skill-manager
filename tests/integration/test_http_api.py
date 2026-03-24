from __future__ import annotations

import unittest

from tests.support import AppTestHarness, seed_divergent_source_fixture


class HttpApiTests(unittest.TestCase):
    def test_empty_fixture_returns_read_only_health_and_empty_catalog(self) -> None:
        with AppTestHarness() as harness:
            health = harness.get_json("/health")
            harnesses = harness.get_json("/harnesses")
            catalog = harness.get_json("/catalog")
            check = harness.get_json("/check")

            self.assertTrue(health["ok"])
            self.assertEqual(len(harnesses), 6)
            self.assertEqual(catalog, [])
            self.assertEqual(check["status"], "warning")

    def test_mixed_fixture_returns_harnesses_catalog_and_catalog_detail(self) -> None:
        with AppTestHarness(mixed=True) as harness:
            harnesses = harness.get_json("/harnesses")
            catalog = harness.get_json("/catalog")

            self.assertEqual(len(harnesses), 6)
            trace_lens = next(entry for entry in catalog if entry["declaredName"] == "Trace Lens")
            detail = harness.get_json(f"/catalog/{trace_lens['skillRef']}")

            self.assertEqual(detail["declaredName"], "Trace Lens")
            self.assertEqual(len(detail["sightings"]), 2)
            self.assertEqual(detail["conflicts"], [])
            self.assertTrue(any(item["harness"] == "codex" for item in detail["sightings"]))

    def test_catalog_detail_reports_divergent_revision_conflict(self) -> None:
        with AppTestHarness(fixture_factory=seed_divergent_source_fixture) as harness:
            catalog = harness.get_json("/catalog")
            policy_kit = next(entry for entry in catalog if entry["declaredName"] == "Policy Kit")
            detail = harness.get_json(f"/catalog/{policy_kit['skillRef']}")

            self.assertEqual(len(detail["conflicts"]), 1)
            self.assertEqual(detail["conflicts"][0]["conflictType"], "divergent_revision")
            self.assertEqual(len(detail["sightings"]), 2)

    def test_unknown_catalog_detail_returns_404_payload(self) -> None:
        with AppTestHarness() as harness:
            payload = harness.get_json("/catalog/missing-entry", expected_status=404)
            self.assertIn("unknown skill ref", payload["error"])


if __name__ == "__main__":
    unittest.main()
