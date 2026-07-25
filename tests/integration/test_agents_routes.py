from __future__ import annotations

import unittest
from pathlib import Path

from tests.support.app_harness import AppTestHarness
from tests.support.fake_home import FakeHomeSpec


def _seed_unmanaged_claude_agent(spec: FakeHomeSpec, slug: str = "stray") -> None:
    agents_dir = spec.home / ".claude" / "agents"
    agents_dir.mkdir(parents=True, exist_ok=True)
    (agents_dir / f"{slug}.md").write_text(
        f"---\nname: {slug.title()}\ndescription: found in claude\n---\n\nharness body\n",
        encoding="utf-8",
    )


class AgentRoutesTests(unittest.TestCase):
    def test_agent_columns_match_the_skills_columns(self) -> None:
        """The two pages must never disagree about which harnesses exist.

        Both derive columns from `enabled_harness_ids_for_family`, so a harness the
        user disables in settings drops out of both at once. This is the regression
        that shipped once: agents used a hand-curated harness list.
        """
        with AppTestHarness() as harness:
            agents = [c["harness"] for c in harness.get_json("/api/agents")["columns"]]
            skills = [
                c["harness"] for c in harness.get_json("/api/skills")["harnessColumns"]
            ]
            # Agents is a subset: openclaw has a skills root but no agent-file format.
            self.assertTrue(set(agents) <= set(skills), f"{agents} not within {skills}")
            # Same relative order, so the two matrices read the same left to right.
            self.assertEqual(agents, [h for h in skills if h in set(agents)])
            for expected in ("claude", "codex", "cursor", "hermes", "agy"):
                self.assertIn(expected, agents)

    def test_disabling_a_harness_drops_its_agents_column(self) -> None:
        with AppTestHarness() as harness:
            before = [c["harness"] for c in harness.get_json("/api/agents")["columns"]]
            self.assertIn("cursor", before)

            harness.put_json("/api/settings/harnesses/cursor/support", {"enabled": False})

            after = [c["harness"] for c in harness.get_json("/api/agents")["columns"]]
            self.assertNotIn("cursor", after)

    def test_hermes_keeps_a_column_but_reports_why_it_cannot_install(self) -> None:
        with AppTestHarness() as harness:
            harness.post_json(
                "/api/agents", {"name": "Red Team", "description": "d", "prompt": "p"}
            )
            entry = self._entry(harness, "red-team")
            hermes = next(b for b in entry["bindings"] if b["harness"] == "hermes")
            self.assertEqual(hermes["state"], "unsupported")
            self.assertIn("dynamically", hermes["detail"])

            payload = harness.post_json(
                "/api/agents/red-team/enable", {"harness": "hermes"}, expected_status=400
            )
            self.assertIn("does not support installable agents", payload["error"])

    def test_codex_gets_a_rendered_toml_not_a_symlink(self) -> None:
        with AppTestHarness() as harness:
            harness.post_json(
                "/api/agents",
                {"name": "PR Reviewer", "description": "reviews", "prompt": "Be strict."},
            )
            harness.post_json("/api/agents/pr-reviewer/enable", {"harness": "codex"})

            rendered = harness.spec.home / ".codex" / "agents" / "pr-reviewer.toml"
            self.assertTrue(rendered.is_file())
            self.assertFalse(rendered.is_symlink())
            body = rendered.read_text(encoding="utf-8")
            self.assertIn('name = "pr_reviewer"', body)
            self.assertIn("skill-manager:generated", body)

            # And it must not come back as an unmanaged row.
            refs = [e["ref"] for e in harness.get_json("/api/agents")["entries"]]
            self.assertEqual(refs, ["pr-reviewer"])

    def test_create_enable_and_disable_round_trip(self) -> None:
        with AppTestHarness() as harness:
            created = harness.post_json(
                "/api/agents",
                {"name": "Red Team", "description": "probes", "prompt": "be adversarial"},
            )
            self.assertEqual(created["ref"], "red-team")

            harness.post_json("/api/agents/red-team/enable", {"harness": "claude"})
            link = harness.spec.home / ".claude" / "agents" / "red-team.md"
            self.assertTrue(link.is_symlink())

            entry = self._entry(harness, "red-team")
            self.assertEqual(entry["kind"], "managed")
            self.assertEqual(self._state(entry, "claude"), "enabled")

            harness.post_json("/api/agents/red-team/disable", {"harness": "claude"})
            self.assertFalse(link.exists())
            self.assertTrue((harness.spec.agents_root / "red-team.md").is_file())

    def test_unmanaged_ref_is_namespaced_and_routes_through_the_path_param(self) -> None:
        """The wire shape unit tests bypass: a ref containing '/' must reach the route."""
        with AppTestHarness(fixture_factory=_seed_unmanaged_claude_agent) as harness:
            entry = self._entry(harness, "claude/stray")
            self.assertEqual(entry["kind"], "unmanaged")
            self.assertTrue(entry["actions"]["canAdopt"])
            self.assertTrue(entry["harnessPath"].endswith("/.claude/agents/stray.md"))

            result = harness.post_json("/api/agents/claude/stray/adopt", {})
            self.assertTrue(result["ok"])
            self.assertEqual(result["ref"], "stray")

            self.assertTrue((harness.spec.agents_root / "stray.md").is_file())
            self.assertTrue((harness.spec.home / ".claude" / "agents" / "stray.md").is_symlink())
            self.assertEqual(self._entry(harness, "stray")["kind"], "managed")

    def test_adopt_collision_returns_409_with_both_paths_and_mutates_nothing(self) -> None:
        with AppTestHarness(fixture_factory=_seed_unmanaged_claude_agent) as harness:
            harness.post_json(
                "/api/agents",
                {"name": "Stray", "description": "ours", "prompt": "ours"},
            )
            store_file = harness.spec.agents_root / "stray.md"
            store_before = store_file.read_text(encoding="utf-8")

            conflict = harness.post_json(
                "/api/agents/claude/stray/adopt", {}, expected_status=409
            )

            self.assertEqual(conflict["conflict"], "store-name-exists")
            self.assertEqual(conflict["slug"], "stray")
            self.assertTrue(conflict["storePath"].endswith("/agents/stray.md"))
            self.assertTrue(conflict["harnessPath"].endswith("/.claude/agents/stray.md"))

            harness_file = harness.spec.home / ".claude" / "agents" / "stray.md"
            self.assertEqual(store_file.read_text(encoding="utf-8"), store_before)
            self.assertFalse(harness_file.is_symlink())

    def test_adopt_keep_store_resolves_the_conflict(self) -> None:
        with AppTestHarness(fixture_factory=_seed_unmanaged_claude_agent) as harness:
            harness.post_json(
                "/api/agents",
                {"name": "Stray", "description": "ours", "prompt": "ours"},
            )
            store_before = (harness.spec.agents_root / "stray.md").read_text(encoding="utf-8")

            result = harness.post_json(
                "/api/agents/claude/stray/adopt", {"onConflict": "keep_store"}
            )

            self.assertTrue(result["ok"])
            self.assertEqual(
                (harness.spec.agents_root / "stray.md").read_text(encoding="utf-8"), store_before
            )
            self.assertTrue((harness.spec.home / ".claude" / "agents" / "stray.md").is_symlink())

    def test_adopt_replace_store_takes_the_harness_version(self) -> None:
        with AppTestHarness(fixture_factory=_seed_unmanaged_claude_agent) as harness:
            harness.post_json(
                "/api/agents",
                {"name": "Stray", "description": "ours", "prompt": "ours"},
            )

            harness.post_json(
                "/api/agents/claude/stray/adopt", {"onConflict": "replace_store"}
            )

            content = (harness.spec.agents_root / "stray.md").read_text(encoding="utf-8")
            self.assertIn("harness body", content)
            self.assertNotIn("ours", content)

    def test_adopt_all_reports_skipped_conflicts(self) -> None:
        def seed(spec: FakeHomeSpec) -> None:
            _seed_unmanaged_claude_agent(spec, "stray")
            _seed_unmanaged_claude_agent(spec, "fresh")

        with AppTestHarness(fixture_factory=seed) as harness:
            harness.post_json(
                "/api/agents", {"name": "Stray", "description": "ours", "prompt": "ours"}
            )

            result = harness.post_json("/api/agents/adopt-all")

            self.assertEqual(result["adopted"], ["fresh"])
            self.assertEqual([row["ref"] for row in result["skipped"]], ["claude/stray"])

    def test_set_harnesses_and_delete(self) -> None:
        with AppTestHarness() as harness:
            harness.post_json(
                "/api/agents", {"name": "Red Team", "description": "d", "prompt": "p"}
            )
            result = harness.post_json(
                "/api/agents/red-team/set-harnesses", {"harnesses": ["claude"]}
            )
            self.assertTrue(result["ok"])
            self.assertIn("claude", result["succeeded"])
            self.assertTrue((harness.spec.home / ".claude" / "agents" / "red-team.md").is_symlink())

            harness.delete_json("/api/agents/red-team")
            self.assertFalse((harness.spec.home / ".claude" / "agents" / "red-team.md").exists())
            self.assertFalse((harness.spec.agents_root / "red-team.md").exists())

    def test_update_agent_drops_legacy_frontmatter(self) -> None:
        def seed(spec: FakeHomeSpec) -> None:
            root = spec.agents_root
            root.mkdir(parents=True, exist_ok=True)
            (root / "legacy.md").write_text(
                "---\nname: Legacy\ndescription: old\n"
                "capabilities:\n  skills:\n    - a\n  mcps:\n    - b\n"
                "harnesses:\n  claude: {}\n---\n\nbody\n",
                encoding="utf-8",
            )

        with AppTestHarness(fixture_factory=seed) as harness:
            updated = harness.put_json("/api/agents/legacy", {"description": "new"})
            self.assertEqual(updated["description"], "new")
            self.assertEqual(updated["prompt"], "body")

            content = (harness.spec.agents_root / "legacy.md").read_text(encoding="utf-8")
            self.assertNotIn("capabilities", content)
            self.assertNotIn("harnesses", content)

    def test_error_body_uses_the_shared_error_field(self) -> None:
        with AppTestHarness() as harness:
            payload = harness.post_json(
                "/api/agents/does-not-exist/enable", {"harness": "claude"}, expected_status=409
            )
            self.assertIn("error", payload)
            self.assertIn("does-not-exist", payload["error"])

    def test_detail_carries_everything_the_detail_view_needs(self) -> None:
        with AppTestHarness() as harness:
            harness.post_json(
                "/api/agents",
                {
                    "name": "Red Team",
                    "description": "probes systems",
                    "prompt": "Be adversarial.",
                    "tools": ["Read", "Bash"],
                },
            )
            harness.post_json("/api/agents/red-team/enable", {"harness": "claude"})
            harness.post_json("/api/agents/red-team/enable", {"harness": "codex"})

            detail = harness.get_json("/api/agents/red-team")

            self.assertEqual(detail["name"], "Red Team")
            self.assertEqual(detail["description"], "probes systems")
            self.assertEqual(detail["prompt"], "Be adversarial.")
            self.assertEqual(detail["tools"], ["Read", "Bash"])
            self.assertTrue(detail["document"].startswith("---"))
            self.assertTrue(detail["storePath"].endswith("/agents/red-team.md"))

            by_harness = {h["harness"]: h for h in detail["harnesses"]}
            # Every column from the matrix is present, so the two agree.
            columns = [c["harness"] for c in harness.get_json("/api/agents")["columns"]]
            self.assertEqual(list(by_harness), columns)

            self.assertEqual(by_harness["claude"]["state"], "enabled")
            self.assertEqual(by_harness["claude"]["installMethod"], "symlink")
            self.assertTrue(by_harness["claude"]["path"].endswith(".claude/agents/red-team.md"))

            # Codex is rendered, not linked — the detail view says so.
            self.assertEqual(by_harness["codex"]["installMethod"], "rendered")
            self.assertTrue(by_harness["codex"]["path"].endswith(".codex/agents/red-team.toml"))

            self.assertEqual(by_harness["hermes"]["state"], "unsupported")
            self.assertEqual(by_harness["hermes"]["installMethod"], "none")
            self.assertIn("dynamically", by_harness["hermes"]["detail"])

    def test_detail_surfaces_frontmatter_and_an_edit_preserves_it(self) -> None:
        """Adopt a real-shaped Claude agent, read its config, edit, config survives."""

        def seed(spec: FakeHomeSpec) -> None:
            agents = spec.home / ".claude" / "agents"
            agents.mkdir(parents=True, exist_ok=True)
            (agents / "bookman.md").write_text(
                "---\n"
                "name: Bookman\n"
                "description: Vault librarian.\n"
                "model: sonnet\n"
                "tools: Read, Grep\n"
                'permissionMode: "acceptEdits"\n'
                "maxTurns: 50\n"
                "disallowedTools: []\n"
                "hooks:\n"
                "  PreToolUse:\n"
                "    - matcher: Bash\n"
                "---\n\nIndex the vault.\n",
                encoding="utf-8",
            )

        with AppTestHarness(fixture_factory=seed) as harness:
            harness.post_json("/api/agents/claude/bookman/adopt", {})

            detail = harness.get_json("/api/agents/bookman")
            config = {row["key"]: row["value"] for row in detail["configuration"]}
            self.assertEqual(detail["description"], "Vault librarian.")
            self.assertEqual(config["model"], "sonnet")
            self.assertEqual(config["permissionMode"], "acceptEdits")
            self.assertEqual(config["maxTurns"], "50")
            self.assertEqual(config["disallowedTools"], "[]")
            self.assertEqual(config["hooks"], "(1 entry)")
            # name/description have their own places in the view.
            self.assertNotIn("name", config)
            self.assertNotIn("description", config)

            harness.put_json("/api/agents/bookman", {"description": "Updated."})

            after = harness.get_json("/api/agents/bookman")
            after_config = {row["key"]: row["value"] for row in after["configuration"]}
            self.assertEqual(after["description"], "Updated.")
            self.assertEqual(after_config, config)

    def test_detail_of_a_missing_agent_is_404(self) -> None:
        with AppTestHarness() as harness:
            payload = harness.get_json("/api/agents/nope", expected_status=404)
            self.assertIn("nope", payload["error"])

    def test_update_preserves_fields_the_client_omits(self) -> None:
        """The edit form must not be able to blank a field by leaving it out.

        The first cut of EditAgentDialog opened with empty inputs and submitted them,
        renaming the agent to its slug and wiping description/prompt/tools.
        """
        with AppTestHarness() as harness:
            harness.post_json(
                "/api/agents",
                {
                    "name": "Red Team",
                    "description": "probes systems",
                    "prompt": "Be adversarial.",
                    "tools": ["Read"],
                },
            )

            updated = harness.put_json("/api/agents/red-team", {"description": "new blurb"})

            self.assertEqual(updated["description"], "new blurb")
            self.assertEqual(updated["name"], "Red Team")
            self.assertEqual(updated["prompt"], "Be adversarial.")
            self.assertEqual(updated["tools"], ["Read"])

    def test_unknown_harness_is_refused(self) -> None:
        with AppTestHarness() as harness:
            harness.post_json(
                "/api/agents", {"name": "Red Team", "description": "d", "prompt": "p"}
            )
            payload = harness.post_json(
                "/api/agents/red-team/enable", {"harness": "nope"}, expected_status=409
            )
            self.assertIn("nope", payload["error"])

    def _entry(self, harness: AppTestHarness, ref: str) -> dict:
        payload = harness.get_json("/api/agents")
        matches = [entry for entry in payload["entries"] if entry["ref"] == ref]
        if not matches:
            raise AssertionError(
                f"no entry {ref!r}; got {[e['ref'] for e in payload['entries']]}"
            )
        return matches[0]

    @staticmethod
    def _state(entry: dict, harness_id: str) -> str:
        return next(b["state"] for b in entry["bindings"] if b["harness"] == harness_id)


if __name__ == "__main__":
    unittest.main()
