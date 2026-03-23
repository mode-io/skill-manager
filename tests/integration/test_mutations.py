from __future__ import annotations

import unittest

from tests.support import (
    AppTestHarness,
    seed_divergent_source_fixture,
    seed_shared_only_fixture,
    seed_skill_package,
)


class MutationTests(unittest.TestCase):
    def test_enable_shared_skill_creates_symlink_and_adds_binding(self) -> None:
        with AppTestHarness(fixture_factory=seed_shared_only_fixture) as harness:
            catalog = harness.get_json("/catalog")
            shared_entry = next(e for e in catalog if e["declaredName"] == "Shared Audit")
            skill_ref = shared_entry["skillRef"]
            self.assertEqual(shared_entry["harnesses"], [])

            result = harness.post_json(f"/catalog/{skill_ref}/enable", {"harness": "codex"})
            self.assertEqual(result["declaredName"], "Shared Audit")
            codex_binding = next((h for h in result["harnesses"] if h["harness"] == "codex"), None)
            self.assertIsNotNone(codex_binding)
            self.assertEqual(codex_binding["state"], "enabled")

            link = harness.spec.home / ".codex" / "skills" / "shared-audit"
            self.assertTrue(link.is_symlink())

    def test_disable_shared_skill_removes_symlink_and_binding(self) -> None:
        with AppTestHarness(fixture_factory=seed_shared_only_fixture) as harness:
            catalog = harness.get_json("/catalog")
            skill_ref = next(e for e in catalog if e["declaredName"] == "Shared Audit")["skillRef"]

            harness.post_json(f"/catalog/{skill_ref}/enable", {"harness": "codex"})
            result = harness.post_json(f"/catalog/{skill_ref}/disable", {"harness": "codex"})
            self.assertEqual(result["declaredName"], "Shared Audit")
            self.assertEqual([h for h in result["harnesses"] if h["harness"] == "codex"], [])

            link = harness.spec.home / ".codex" / "skills" / "shared-audit"
            self.assertFalse(link.exists())

    def test_enable_is_idempotent(self) -> None:
        with AppTestHarness(fixture_factory=seed_shared_only_fixture) as harness:
            catalog = harness.get_json("/catalog")
            skill_ref = next(e for e in catalog if e["declaredName"] == "Shared Audit")["skillRef"]

            harness.post_json(f"/catalog/{skill_ref}/enable", {"harness": "codex"})
            result = harness.post_json(f"/catalog/{skill_ref}/enable", {"harness": "codex"})
            codex_bindings = [h for h in result["harnesses"] if h["harness"] == "codex"]
            self.assertEqual(len(codex_bindings), 1)

    def test_disable_is_idempotent(self) -> None:
        with AppTestHarness(fixture_factory=seed_shared_only_fixture) as harness:
            catalog = harness.get_json("/catalog")
            skill_ref = next(e for e in catalog if e["declaredName"] == "Shared Audit")["skillRef"]

            result = harness.post_json(f"/catalog/{skill_ref}/disable", {"harness": "codex"})
            self.assertEqual(result["declaredName"], "Shared Audit")

    def test_enable_unknown_skill_returns_404(self) -> None:
        with AppTestHarness() as harness:
            result = harness.post_json("/catalog/missing-ref/enable", {"harness": "codex"}, expected_status=404)
            self.assertIn("unknown skill ref", result["error"])

    def test_enable_unmanaged_skill_returns_400(self) -> None:
        with AppTestHarness(mixed=True) as harness:
            catalog = harness.get_json("/catalog")
            unmanaged = next(e for e in catalog if e["ownership"] == "unmanaged")
            result = harness.post_json(
                f"/catalog/{unmanaged['skillRef']}/enable", {"harness": "codex"}, expected_status=400
            )
            self.assertIn("only shared skills", result["error"])

    def test_enable_unknown_harness_returns_400(self) -> None:
        with AppTestHarness(fixture_factory=seed_shared_only_fixture) as harness:
            catalog = harness.get_json("/catalog")
            skill_ref = next(e for e in catalog if e["declaredName"] == "Shared Audit")["skillRef"]
            result = harness.post_json(f"/catalog/{skill_ref}/enable", {"harness": "nope"}, expected_status=400)
            self.assertIn("unknown harness", result["error"])

    def test_disable_real_directory_returns_409(self) -> None:
        with AppTestHarness(fixture_factory=seed_shared_only_fixture) as harness:
            seed_skill_package(harness.spec.home / ".codex" / "skills", "shared-audit", "Local Copy")
            catalog = harness.get_json("/catalog")
            shared = next(e for e in catalog if e["ownership"] == "shared" and e["declaredName"] == "Shared Audit")
            result = harness.post_json(
                f"/catalog/{shared['skillRef']}/disable", {"harness": "codex"}, expected_status=409
            )
            self.assertIn("not a symlink", result["error"])


class CentralizeTests(unittest.TestCase):
    def test_centralize_moves_unmanaged_to_shared_with_bindings(self) -> None:
        with AppTestHarness(mixed=True) as harness:
            catalog = harness.get_json("/catalog")
            policy_kit = next(e for e in catalog if e["declaredName"] == "Policy Kit" and e["ownership"] == "unmanaged")
            result = harness.post_json(f"/catalog/{policy_kit['skillRef']}/centralize")
            self.assertEqual(result["ownership"], "shared")
            self.assertEqual(result["declaredName"], "Policy Kit")
            self.assertTrue(any(h["harness"] == "opencode" for h in result["harnesses"]))
            pkg_path = harness.spec.xdg_config_home / "opencode" / "skills" / "policy-kit"
            self.assertTrue(pkg_path.is_symlink())

    def test_centralize_multiple_harness_copies_all_become_symlinks(self) -> None:
        with AppTestHarness(mixed=True) as harness:
            catalog = harness.get_json("/catalog")
            trace_lens = next(e for e in catalog if e["declaredName"] == "Trace Lens" and e["ownership"] == "unmanaged")
            result = harness.post_json(f"/catalog/{trace_lens['skillRef']}/centralize")
            self.assertEqual(result["ownership"], "shared")
            self.assertEqual(len(result["harnesses"]), 2)
            codex_link = harness.spec.home / ".codex" / "skills" / "trace-lens"
            claude_link = harness.spec.home / ".claude" / "skills" / "trace-lens-copy"
            self.assertTrue(codex_link.is_symlink())
            self.assertTrue(claude_link.is_symlink())
            self.assertEqual(codex_link.resolve(), claude_link.resolve())

    def test_centralize_refuses_shared_skill(self) -> None:
        with AppTestHarness(mixed=True) as harness:
            catalog = harness.get_json("/catalog")
            shared = next(e for e in catalog if e["ownership"] == "shared")
            result = harness.post_json(f"/catalog/{shared['skillRef']}/centralize", expected_status=400)
            self.assertIn("only unmanaged", result["error"])

    def test_centralize_refuses_builtin_skill(self) -> None:
        with AppTestHarness(mixed=True) as harness:
            catalog = harness.get_json("/catalog")
            builtin = next(e for e in catalog if e["ownership"] == "builtin")
            result = harness.post_json(f"/catalog/{builtin['skillRef']}/centralize", expected_status=400)
            self.assertIn("only unmanaged", result["error"])

    def test_centralize_refuses_conflicted_skill(self) -> None:
        with AppTestHarness(fixture_factory=seed_divergent_source_fixture) as harness:
            catalog = harness.get_json("/catalog")
            policy_kit = next(e for e in catalog if e["declaredName"] == "Policy Kit")
            self.assertTrue(len(policy_kit["conflicts"]) > 0)
            result = harness.post_json(f"/catalog/{policy_kit['skillRef']}/centralize", expected_status=409)
            self.assertIn("resolve conflicts", result["error"])

    def test_centralize_unknown_skill_returns_404(self) -> None:
        with AppTestHarness() as harness:
            result = harness.post_json("/catalog/missing-ref/centralize", expected_status=404)
            self.assertIn("unknown skill ref", result["error"])


if __name__ == "__main__":
    unittest.main()
