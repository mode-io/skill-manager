from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.application.agents import (
    AgentAdoptConflict,
    AgentHarnessAdapter,
    AgentInventoryService,
    AgentMutationService,
    AgentParseError,
    AgentStore,
    AgentTarget,
    parse_agent_document,
    render_agent_document,
)
from skill_manager.errors import MutationError

AGENT_DOC = """---
name: Chief of Staff
description: Orchestrates tasks and delegates work.
tools: Read, Bash
---
You are the Chief of Staff. Delegate; do not code.
"""

# The retired compile model wrote these keys. Files on disk still carry them.
LEGACY_AGENT_DOC = """---
name: Legacy Agent
description: Written by the old compile model.
capabilities:
  skills:
    - project-context
  mcps:
    - github-mcp
  tools:
    allowed:
      - read_file
    denied:
      - execute_sql
harnesses:
  claude:
    model: claude-sonnet-5
---
Legacy prompt body.
"""


def _write(path: Path, document: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(document, encoding="utf-8")
    return path


class AgentParserTests(unittest.TestCase):
    def test_parses_name_description_prompt_and_tools(self) -> None:
        agent = parse_agent_document(AGENT_DOC, slug="chief", path=Path("chief.md"))
        self.assertEqual(agent.name, "Chief of Staff")
        self.assertEqual(agent.description, "Orchestrates tasks and delegates work.")
        self.assertEqual(agent.tools, ("Read", "Bash"))
        self.assertEqual(agent.prompt, "You are the Chief of Staff. Delegate; do not code.")

    def test_legacy_capability_keys_are_ignored_not_fatal(self) -> None:
        agent = parse_agent_document(LEGACY_AGENT_DOC, slug="legacy", path=Path("legacy.md"))
        self.assertEqual(agent.name, "Legacy Agent")
        self.assertEqual(agent.tools, ())
        self.assertEqual(agent.prompt, "Legacy prompt body.")

    def test_tools_accepts_a_yaml_list(self) -> None:
        document = "---\nname: L\ndescription: d\ntools:\n  - Read\n  - Edit\n---\nbody\n"
        agent = parse_agent_document(document, slug="l", path=Path("l.md"))
        self.assertEqual(agent.tools, ("Read", "Edit"))

    def test_missing_frontmatter_is_an_error(self) -> None:
        with self.assertRaises(AgentParseError):
            parse_agent_document("no frontmatter here", slug="x", path=Path("x.md"))

    def test_unterminated_frontmatter_is_an_error(self) -> None:
        with self.assertRaises(AgentParseError):
            parse_agent_document("---\nname: X\nbody", slug="x", path=Path("x.md"))

    def test_unknown_frontmatter_survives_an_edit(self) -> None:
        """The keys a harness owns must never be collateral damage of an edit.

        Real Claude agents carry model / permissionMode / maxTurns / hooks and more.
        Re-rendering from just name+description+tools deleted all of it.
        """
        document = (
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
            "---\n\nIndex the vault.\n"
        )
        agent = parse_agent_document(document, slug="bookman", path=Path("bookman.md"))

        rewritten = render_agent_document(
            name=agent.name,
            description="Vault librarian, updated.",
            prompt=agent.prompt,
            tools=agent.tools,
            base_metadata=agent.metadata,
        )

        reparsed = parse_agent_document(rewritten, slug="bookman", path=Path("bookman.md"))
        self.assertEqual(reparsed.description, "Vault librarian, updated.")
        self.assertEqual(reparsed.name, "Bookman")
        self.assertEqual(reparsed.prompt, "Index the vault.")
        self.assertEqual(
            [key for key, _ in reparsed.extra_metadata],
            ["model", "tools", "permissionMode", "maxTurns", "disallowedTools", "hooks"],
        )
        self.assertEqual(reparsed.metadata["model"], "sonnet")
        self.assertEqual(reparsed.metadata["maxTurns"], 50)
        self.assertEqual(reparsed.metadata["permissionMode"], "acceptEdits")
        self.assertEqual(reparsed.metadata["hooks"], {"PreToolUse": [{"matcher": "Bash"}]})

    def test_empty_string_values_round_trip_as_empty_strings(self) -> None:
        """`effort: ""` must not silently become null on the way back out."""
        document = '---\nname: A\ndescription: d\neffort: ""\n---\n\nbody\n'
        agent = parse_agent_document(document, slug="a", path=Path("a.md"))
        self.assertEqual(agent.metadata["effort"], "")

        rewritten = render_agent_document(
            name=agent.name,
            description=agent.description,
            prompt=agent.prompt,
            tools=agent.tools,
            base_metadata=agent.metadata,
        )
        self.assertIn('effort: ""', rewritten)
        self.assertEqual(
            parse_agent_document(rewritten, slug="a", path=Path("a.md")).metadata["effort"], ""
        )

    def test_extra_metadata_excludes_the_fields_shown_on_their_own(self) -> None:
        agent = parse_agent_document(AGENT_DOC, slug="chief", path=Path("chief.md"))
        keys = [key for key, _ in agent.extra_metadata]
        self.assertNotIn("name", keys)
        self.assertNotIn("description", keys)
        self.assertIn("tools", keys)

    def test_render_drops_legacy_keys(self) -> None:
        """Our own retired compile keys are the one thing still dropped on write."""
        agent = parse_agent_document(LEGACY_AGENT_DOC, slug="legacy", path=Path("legacy.md"))
        rendered = render_agent_document(
            name=agent.name,
            description=agent.description,
            prompt=agent.prompt,
            tools=agent.tools,
            base_metadata=agent.metadata,
        )
        self.assertNotIn("capabilities", rendered)
        self.assertNotIn("harnesses", rendered)
        self.assertIn("name: Legacy Agent", rendered)


class AgentsFixture(unittest.TestCase):
    """Store + a single 'claude' harness target wired to a temp directory."""

    def setUp(self) -> None:
        self._tmp = TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        root = Path(self._tmp.name)
        self.store_root = root / "data" / "agents"
        self.harness_dir = root / "home" / ".claude" / "agents"
        self.store_root.mkdir(parents=True)
        self.harness_dir.mkdir(parents=True)

        self.target = AgentTarget(
            id="claude",
            label="Claude",
            logo_key="claude",
            root_path=self.harness_dir.parent,
            output_dir=self.harness_dir,
            file_glob="*.md",
            render_format="markdown",
            docs_url="",
            installed=True,
        )
        self.store = AgentStore(self.store_root)
        self.adapter = AgentHarnessAdapter(self.target, self.store_root)
        self.adapters = {"claude": self.adapter}
        snapshot = lambda: ((self.target,), self.adapters)
        self.inventory = AgentInventoryService(self.store, snapshot)
        self.mutations = AgentMutationService(self.store, snapshot)

    def entry(self, ref: str):
        return next(e for e in self.inventory.build().entries if e.ref == ref)


class CodexAgentTests(unittest.TestCase):
    """Codex reads TOML, not markdown, so it is rendered and marker-owned."""

    def setUp(self) -> None:
        self._tmp = TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        root = Path(self._tmp.name)
        self.store_root = root / "data" / "agents"
        self.harness_dir = root / "home" / ".codex" / "agents"
        self.store_root.mkdir(parents=True)
        self.harness_dir.mkdir(parents=True)

        self.target = AgentTarget(
            id="codex",
            label="Codex",
            logo_key="codex",
            root_path=self.harness_dir.parent,
            output_dir=self.harness_dir,
            file_glob="*.toml",
            render_format="codex_toml",
            docs_url="",
            installed=True,
        )
        self.store = AgentStore(self.store_root)
        self.adapter = AgentHarnessAdapter(self.target, self.store_root)
        adapters = {"codex": self.adapter}
        snapshot = lambda: ((self.target,), adapters)
        self.inventory = AgentInventoryService(self.store, snapshot)
        self.mutations = AgentMutationService(self.store, snapshot)

    def test_enable_renders_toml_with_underscored_name(self) -> None:
        self.store.create(name="PR Reviewer", description="reviews", prompt="Be strict.")
        self.mutations.enable("pr-reviewer", "codex")

        rendered = self.harness_dir / "pr-reviewer.toml"
        self.assertTrue(rendered.is_file())
        self.assertFalse(rendered.is_symlink())

        import tomllib

        data = tomllib.loads(rendered.read_text(encoding="utf-8"))
        # Codex resolves by `name`, not filename; their example pairs a hyphenated
        # file with an underscored name.
        self.assertEqual(data["name"], "pr_reviewer")
        self.assertEqual(data["description"], "reviews")
        self.assertEqual(data["developer_instructions"].strip(), "Be strict.")

    def test_rendered_file_is_owned_not_reported_unmanaged(self) -> None:
        self.store.create(name="PR Reviewer", description="d", prompt="p")
        self.mutations.enable("pr-reviewer", "codex")

        inventory = self.inventory.build()
        self.assertEqual([e.ref for e in inventory.entries], ["pr-reviewer"])
        self.assertEqual(inventory.entries[0].bindings[0].state, "enabled")

    def test_disable_removes_only_generated_files(self) -> None:
        self.store.create(name="PR Reviewer", description="d", prompt="p")
        self.mutations.enable("pr-reviewer", "codex")
        self.mutations.disable("pr-reviewer", "codex")
        self.assertFalse((self.harness_dir / "pr-reviewer.toml").exists())

        hand_written = self.harness_dir / "pr-reviewer.toml"
        hand_written.write_text('name = "pr_reviewer"\n', encoding="utf-8")
        with self.assertRaises(MutationError):
            self.mutations.disable("pr-reviewer", "codex")
        self.assertTrue(hand_written.is_file())

    def test_enable_refuses_to_overwrite_a_hand_written_file(self) -> None:
        self.store.create(name="PR Reviewer", description="d", prompt="p")
        (self.harness_dir / "pr-reviewer.toml").write_text(
            'name = "mine"\n', encoding="utf-8"
        )
        with self.assertRaises(MutationError):
            self.mutations.enable("pr-reviewer", "codex")

    def test_hand_written_toml_is_unmanaged_and_adopts_into_markdown(self) -> None:
        (self.harness_dir / "auditor.toml").write_text(
            'name = "auditor"\n'
            'description = "audits things"\n'
            'developer_instructions = """\nCheck everything.\n"""\n',
            encoding="utf-8",
        )

        entry = next(
            e for e in self.inventory.build().entries if e.ref == "codex/auditor"
        )
        self.assertEqual(entry.kind, "unmanaged")
        self.assertEqual(entry.name, "auditor")
        self.assertEqual(entry.description, "audits things")

        self.mutations.adopt("codex/auditor")

        # The store always holds markdown, whatever the harness format was.
        stored = (self.store_root / "auditor.md").read_text(encoding="utf-8")
        self.assertTrue(stored.startswith("---"))
        self.assertIn("name: auditor", stored)
        self.assertIn("Check everything.", stored)
        # And the harness gets a freshly rendered, owned TOML back.
        self.assertTrue((self.harness_dir / "auditor.toml").is_file())
        self.assertEqual(
            [e.ref for e in self.inventory.build().entries], ["auditor"]
        )

    def test_unparseable_toml_becomes_an_issue(self) -> None:
        (self.harness_dir / "broken.toml").write_text("not = = toml", encoding="utf-8")
        issues = self.inventory.build().issues
        self.assertEqual([i.name for i in issues], ["codex/broken"])


class UnsupportedHarnessTests(unittest.TestCase):
    """A harness with no agent-file format keeps its column and says why."""

    def setUp(self) -> None:
        self._tmp = TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        root = Path(self._tmp.name)
        self.store_root = root / "data" / "agents"
        self.store_root.mkdir(parents=True)

        self.target = AgentTarget(
            id="hermes",
            label="Hermes Agent",
            logo_key="hermes",
            root_path=root / "home" / ".hermes",
            output_dir=root / "home" / ".hermes" / "agents",
            file_glob="*.md",
            render_format="markdown",
            docs_url="",
            installed=True,
            unavailable_reason="Hermes spawns subagents dynamically",
        )
        self.store = AgentStore(self.store_root)
        adapters = {"hermes": AgentHarnessAdapter(self.target, self.store_root)}
        snapshot = lambda: ((self.target,), adapters)
        self.inventory = AgentInventoryService(self.store, snapshot)
        self.mutations = AgentMutationService(self.store, snapshot)

    def test_column_is_present_but_every_cell_is_unsupported(self) -> None:
        self.store.create(name="Red Team", description="d", prompt="p")
        entry = self.inventory.build().entries[0]
        binding = entry.bindings[0]
        self.assertEqual(binding.state, "unsupported")
        self.assertEqual(binding.detail, "Hermes spawns subagents dynamically")

    def test_enabling_is_refused_with_the_reason(self) -> None:
        self.store.create(name="Red Team", description="d", prompt="p")
        with self.assertRaises(MutationError) as caught:
            self.mutations.enable("red-team", "hermes")
        self.assertIn("spawns subagents dynamically", str(caught.exception))


class AgentBindingTests(AgentsFixture):
    def test_enable_creates_a_symlink_into_the_store(self) -> None:
        agent = self.store.create(name="Red Team", description="probe", prompt="be adversarial")
        self.mutations.enable("red-team", "claude")
        link = self.harness_dir / "red-team.md"
        self.assertTrue(link.is_symlink())
        self.assertEqual(link.resolve(), agent.path.resolve())
        self.assertEqual(self.entry("red-team").bindings[0].state, "enabled")

    def test_disable_removes_the_symlink_but_keeps_the_store_file(self) -> None:
        self.store.create(name="Red Team", description="probe", prompt="p")
        self.mutations.enable("red-team", "claude")
        self.mutations.disable("red-team", "claude")
        self.assertFalse((self.harness_dir / "red-team.md").exists())
        self.assertTrue((self.store_root / "red-team.md").is_file())

    def test_disable_refuses_to_delete_a_real_file(self) -> None:
        self.store.create(name="Red Team", description="probe", prompt="p")
        _write(self.harness_dir / "red-team.md", "---\nname: theirs\ndescription: d\n---\nbody\n")
        with self.assertRaises(MutationError):
            self.mutations.disable("red-team", "claude")
        self.assertTrue((self.harness_dir / "red-team.md").is_file())

    def test_enable_refuses_to_overwrite_a_real_file(self) -> None:
        self.store.create(name="Red Team", description="probe", prompt="p")
        _write(self.harness_dir / "red-team.md", "---\nname: theirs\ndescription: d\n---\nbody\n")
        with self.assertRaises(MutationError):
            self.mutations.enable("red-team", "claude")

    def test_unknown_harness_is_rejected(self) -> None:
        self.store.create(name="Red Team", description="probe", prompt="p")
        with self.assertRaises(MutationError):
            self.mutations.enable("red-team", "cursor")

    def test_set_harnesses_enables_listed_and_disables_the_rest(self) -> None:
        self.store.create(name="Red Team", description="probe", prompt="p")
        self.mutations.enable("red-team", "claude")
        succeeded, failed = self.mutations.set_harnesses("red-team", [])
        self.assertEqual(failed, [])
        self.assertEqual(succeeded, ["claude"])
        self.assertFalse((self.harness_dir / "red-team.md").exists())

    def test_delete_removes_bindings_and_the_store_file(self) -> None:
        self.store.create(name="Red Team", description="probe", prompt="p")
        self.mutations.enable("red-team", "claude")
        self.mutations.delete("red-team")
        self.assertFalse((self.harness_dir / "red-team.md").exists())
        self.assertFalse((self.store_root / "red-team.md").exists())


class AgentInventoryTests(AgentsFixture):
    def test_real_harness_file_is_reported_unmanaged_and_adoptable(self) -> None:
        _write(self.harness_dir / "stray.md", "---\nname: Stray\ndescription: d\n---\nbody\n")
        entry = self.entry("claude/stray")
        self.assertEqual(entry.kind, "unmanaged")
        self.assertTrue(entry.can_adopt)
        self.assertEqual(entry.harness_path, self.harness_dir / "stray.md")

    def test_dangling_symlink_is_disabled_with_a_detail(self) -> None:
        # The store entry still exists, but the link points somewhere that is gone —
        # e.g. it was written against an older store path.
        self.store.create(name="Red Team", description="probe", prompt="p")
        link = self.harness_dir / "red-team.md"
        link.symlink_to(self.store_root / "moved-away.md")
        binding = self.entry("red-team").bindings[0]
        self.assertEqual(binding.state, "disabled")
        self.assertEqual(binding.detail, "symlink points at a missing file")

    def test_orphaned_link_is_reported_as_an_issue(self) -> None:
        # Store file deleted out from under us: the agent has no row left to hang a
        # binding off, so the dead link must surface as an issue rather than silently.
        agent = self.store.create(name="Red Team", description="probe", prompt="p")
        self.mutations.enable("red-team", "claude")
        agent.path.unlink()

        inventory = self.inventory.build()

        self.assertEqual([e.ref for e in inventory.entries], [])
        self.assertEqual([issue.name for issue in inventory.issues], ["claude/red-team"])
        self.assertIn("no longer in the store", inventory.issues[0].reason)

    def test_our_symlink_is_never_listed_as_unmanaged(self) -> None:
        self.store.create(name="Red Team", description="probe", prompt="p")
        self.mutations.enable("red-team", "claude")
        refs = [e.ref for e in self.inventory.build().entries]
        self.assertEqual(refs, ["red-team"])

    def test_unparseable_store_file_becomes_an_issue(self) -> None:
        _write(self.store_root / "broken.md", "not frontmatter")
        issues = self.inventory.build().issues
        self.assertEqual([issue.name for issue in issues], ["broken"])


class AgentAdoptTests(AgentsFixture):
    def test_adopt_moves_the_file_into_the_store_and_leaves_a_symlink(self) -> None:
        _write(self.harness_dir / "stray.md", "---\nname: Stray\ndescription: d\n---\nbody\n")
        self.assertEqual(self.mutations.adopt("claude/stray"), "stray")
        self.assertTrue((self.store_root / "stray.md").is_file())
        link = self.harness_dir / "stray.md"
        self.assertTrue(link.is_symlink())
        self.assertEqual(link.resolve(), (self.store_root / "stray.md").resolve())

    def test_bare_adopt_on_a_collision_raises_and_mutates_nothing(self) -> None:
        self.store.create(name="Stray", description="ours", prompt="ours")
        store_before = (self.store_root / "stray.md").read_text(encoding="utf-8")
        harness_doc = "---\nname: Stray\ndescription: theirs\n---\ntheirs\n"
        _write(self.harness_dir / "stray.md", harness_doc)

        with self.assertRaises(AgentAdoptConflict) as caught:
            self.mutations.adopt("claude/stray")

        self.assertEqual(caught.exception.slug, "stray")
        self.assertEqual(caught.exception.store_path, self.store_root / "stray.md")
        self.assertEqual(caught.exception.harness_path, self.harness_dir / "stray.md")
        # Both sides untouched.
        self.assertEqual((self.store_root / "stray.md").read_text(encoding="utf-8"), store_before)
        self.assertEqual((self.harness_dir / "stray.md").read_text(encoding="utf-8"), harness_doc)
        self.assertFalse((self.harness_dir / "stray.md").is_symlink())

    def test_keep_store_discards_the_harness_file(self) -> None:
        self.store.create(name="Stray", description="ours", prompt="ours")
        store_before = (self.store_root / "stray.md").read_text(encoding="utf-8")
        _write(self.harness_dir / "stray.md", "---\nname: Stray\ndescription: theirs\n---\ntheirs\n")

        self.mutations.adopt("claude/stray", "keep_store")

        self.assertEqual((self.store_root / "stray.md").read_text(encoding="utf-8"), store_before)
        self.assertTrue((self.harness_dir / "stray.md").is_symlink())

    def test_replace_store_takes_the_harness_version(self) -> None:
        self.store.create(name="Stray", description="ours", prompt="ours")
        harness_doc = "---\nname: Stray\ndescription: theirs\n---\ntheirs\n"
        _write(self.harness_dir / "stray.md", harness_doc)

        self.mutations.adopt("claude/stray", "replace_store")

        self.assertEqual((self.store_root / "stray.md").read_text(encoding="utf-8"), harness_doc)
        self.assertTrue((self.harness_dir / "stray.md").is_symlink())

    def test_adopt_all_skips_conflicts_and_reports_them(self) -> None:
        self.store.create(name="Stray", description="ours", prompt="ours")
        _write(self.harness_dir / "stray.md", "---\nname: Stray\ndescription: theirs\n---\nt\n")
        _write(self.harness_dir / "fresh.md", "---\nname: Fresh\ndescription: d\n---\nbody\n")

        result = self.mutations.adopt_all()

        self.assertEqual(result.adopted, ("fresh",))
        self.assertEqual([ref for ref, _ in result.skipped], ["claude/stray"])
        self.assertFalse((self.harness_dir / "stray.md").is_symlink())

    def test_adopt_rejects_a_traversal_ref(self) -> None:
        with self.assertRaises(MutationError):
            self.mutations.adopt("claude/../../etc/passwd")

    def test_adopt_rejects_a_ref_without_a_harness(self) -> None:
        with self.assertRaises(MutationError):
            self.mutations.adopt("stray")


class AgentStoreTests(AgentsFixture):
    def test_create_slugifies_the_name(self) -> None:
        agent = self.store.create(name="Chief of Staff", description="d", prompt="p")
        self.assertEqual(agent.slug, "chief-of-staff")
        self.assertTrue((self.store_root / "chief-of-staff.md").is_file())

    def test_create_refuses_a_duplicate(self) -> None:
        self.store.create(name="Dup", description="d", prompt="p")
        with self.assertRaises(MutationError):
            self.store.create(name="Dup", description="d2", prompt="p2")

    def test_update_preserves_unspecified_fields(self) -> None:
        self.store.create(name="Keep", description="original", prompt="body")
        updated = self.store.update("keep", description="changed")
        self.assertEqual(updated.description, "changed")
        self.assertEqual(updated.prompt, "body")
        self.assertEqual(updated.name, "Keep")

    def test_path_for_rejects_traversal(self) -> None:
        with self.assertRaises(MutationError):
            self.store.path_for("../escape")


if __name__ == "__main__":
    unittest.main()
