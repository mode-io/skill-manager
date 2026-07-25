from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.application import build_backend_container
from skill_manager.application.agents.parser import parse_agent_file
from skill_manager.application.container import _migrate_legacy_layouts
from skill_manager.application.skills.manifest import SkillStoreEntry
from skill_manager.application.skills.package import fingerprint_package
from skill_manager.sources import ResolvedGitHubSkill
from tests.support.fake_home import (
    create_fake_home_spec,
    seed_divergent_source_fixture,
    seed_managed_linked_fixture,
    seed_mixed_fixture,
    seed_skill_package,
    seed_store_manifest,
)
from tests.support.marketplace_fixture import create_fixture_marketplace_service


class _StaticGitHubSource:
    def __init__(
        self,
        package_root: Path,
        *,
        repo: str = "mode-io/skills",
        ref: str = "main",
        relative_path: str = ".",
    ) -> None:
        self.package_root = package_root
        self.repo = repo
        self.ref = ref
        self.relative_path = relative_path

    def fetch(self, locator: str, work_dir: Path) -> Path:
        return self.package_root

    def resolve(self, locator: str, work_dir: Path) -> ResolvedGitHubSkill:
        return ResolvedGitHubSkill(
            repo=self.repo,
            ref=self.ref,
            relative_path=self.relative_path,
            package_path=self.package_root,
            clone_dir=work_dir / self.repo.replace("/", "--"),
        )


class BackendContainerServiceTests(unittest.TestCase):
    def test_list_skills_groups_identical_local_copies_and_emits_two_public_statuses(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            seed_mixed_fixture(spec)
            container = build_backend_container(spec.env())
            payload = container.skills_queries.list_skills()

            self.assertEqual(payload["summary"], {"managed": 1, "unmanaged": 2})

            shared_audit = next(row for row in payload["rows"] if row["name"] == "Shared Audit")
            trace_lens = next(row for row in payload["rows"] if row["name"] == "Trace Lens")
            policy_kit = next(row for row in payload["rows"] if row["name"] == "Policy Kit")

            self.assertEqual(shared_audit["displayStatus"], "Managed")
            self.assertEqual(
                shared_audit["actions"],
                {"canManage": False, "canStopManaging": False, "canDelete": True},
            )
            self.assertEqual(trace_lens["displayStatus"], "Unmanaged")
            self.assertEqual(
                trace_lens["actions"],
                {"canManage": True, "canStopManaging": False, "canDelete": False},
            )
            self.assertEqual(
                {cell["harness"] for cell in trace_lens["cells"] if cell["state"] == "found"},
                {"codex", "claude", "opencode"},
            )
            self.assertEqual(policy_kit["displayStatus"], "Unmanaged")

    def test_detail_and_source_status_are_split(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            package_root = seed_skill_package(
                spec.skills_store_root,
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
                    SkillStoreEntry(
                        package_dir="audit-skill",
                        declared_name="Audit Skill",
                        source_kind="github",
                        source_locator="github:mode-io/audit-skill",
                        revision=f"{current_revision}-old",
                    )
                ],
            )

            container = build_backend_container(spec.env())
            payload = container.skills_queries.list_skills()
            audit = next(row for row in payload["rows"] if row["name"] == "Audit Skill")
            detail = container.skills_queries.get_skill_detail(audit["skillRef"])
            source_status = container.skills_queries.get_skill_source_status(audit["skillRef"])

            assert detail is not None
            assert source_status is not None

            self.assertEqual(detail["displayStatus"], "Managed")
            self.assertEqual(detail["attentionMessage"], "Local changes detected. Source updates are disabled.")
            self.assertNotIn("updateStatus", detail["actions"])
            self.assertEqual(source_status["updateStatus"], "local_changes_detected")
            self.assertEqual(detail["actions"]["stopManagingStatus"], "disabled_no_enabled")
            self.assertEqual(detail["actions"]["stopManagingHarnessLabels"], [])

    def test_divergent_source_backed_local_copies_become_separate_found_rows(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            seed_divergent_source_fixture(spec)
            container = build_backend_container(spec.env())

            payload = container.skills_queries.list_skills()
            policy_rows = [row for row in payload["rows"] if row["name"] == "Policy Kit"]

            self.assertEqual(len(policy_rows), 2)
            self.assertTrue(all(row["displayStatus"] == "Unmanaged" for row in policy_rows))

    def test_settings_surface_store_issues(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            seed_mixed_fixture(spec)
            container = build_backend_container(spec.env())

            settings = container.settings_queries.get_settings()

            self.assertEqual(settings["storage"]["skillsStorePath"], str(spec.skills_store_root))
            self.assertEqual(
                settings["storage"]["marketplaceCachePath"],
                str(spec.xdg_data_home / "skill-manager" / "marketplace"),
            )
            self.assertEqual(len(settings["harnesses"]), 7)
            codex = next(item for item in settings["harnesses"] if item["harness"] == "codex")
            self.assertIn("managedLocation", codex)
            self.assertIn("installed", codex)
            self.assertNotIn("discoveryMode", codex)
            self.assertNotIn("centralStore", settings)
            self.assertNotIn("topology", settings)

    def test_skill_detail_exposes_document_markdown_for_shared_and_unmanaged_skills(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            seed_mixed_fixture(spec)
            container = build_backend_container(spec.env())

            payload = container.skills_queries.list_skills()
            shared = next(row for row in payload["rows"] if row["name"] == "Shared Audit")
            found = next(row for row in payload["rows"] if row["name"] == "Trace Lens")

            shared_detail = container.skills_queries.get_skill_detail(shared["skillRef"])
            found_detail = container.skills_queries.get_skill_detail(found["skillRef"])

            assert shared_detail is not None
            assert found_detail is not None

            self.assertIn("Shared package fixture.", shared_detail["documentMarkdown"])
            self.assertIn("trace", found_detail["documentMarkdown"])
            self.assertNotIn("advanced", shared_detail)
            self.assertEqual(shared_detail["actions"]["stopManagingStatus"], "disabled_no_enabled")
            self.assertEqual(shared_detail["actions"]["stopManagingHarnessLabels"], [])
            self.assertIsNone(found_detail["actions"]["stopManagingStatus"])
            self.assertEqual(found_detail["actions"]["stopManagingHarnessLabels"], ["Claude"])
            self.assertEqual(found_detail["actions"]["deleteHarnessLabels"], ["Claude"])
            self.assertIsNone(found_detail["sourceLinks"])

    def test_skill_detail_orders_managed_locations_with_shared_store_first(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            seed_managed_linked_fixture(spec)
            container = build_backend_container(spec.env())

            payload = container.skills_queries.list_skills()
            shared = next(row for row in payload["rows"] if row["name"] == "Shared Audit")
            detail = container.skills_queries.get_skill_detail(shared["skillRef"])

            assert detail is not None

            self.assertEqual([location["label"] for location in detail["locations"]], ["Shared Store", "Antigravity", "Codex", "OpenClaw", "OpenCode"])
            self.assertEqual(detail["locations"][0]["path"], str(spec.skills_store_root / "shared-audit"))
            self.assertEqual(detail["locations"][1]["path"], str(spec.codex_root / "shared-audit"))
            self.assertEqual(detail["actions"]["stopManagingStatus"], "available")
            self.assertEqual(detail["actions"]["stopManagingHarnessLabels"], ["Codex"])

    def test_source_links_use_persisted_exact_folder_url(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            package_root = seed_skill_package(
                spec.skills_store_root,
                "shared-audit",
                "Shared Audit",
                body="Shared package fixture.",
                source_kind="github",
                source_locator="github:mode-io/skills/shared-audit",
            )
            seed_store_manifest(
                spec,
                [
                    SkillStoreEntry(
                        package_dir="shared-audit",
                        declared_name="Shared Audit",
                        source_kind="github",
                        source_locator="github:mode-io/skills/shared-audit",
                        revision=fingerprint_package(package_root)[0],
                        source_ref="main",
                        source_path="skills/shared-audit",
                    )
                ],
            )

            container = build_backend_container(spec.env())
            payload = container.skills_queries.list_skills()
            shared = next(row for row in payload["rows"] if row["name"] == "Shared Audit")
            detail = container.skills_queries.get_skill_detail(shared["skillRef"])
            source_status = container.skills_queries.get_skill_source_status(shared["skillRef"])

            assert detail is not None
            assert source_status is not None

            self.assertEqual(detail["sourceLinks"], {
                "repoLabel": "mode-io/skills",
                "repoUrl": "https://github.com/mode-io/skills",
                "folderUrl": "https://github.com/mode-io/skills/tree/main/skills/shared-audit",
            })
            self.assertEqual(source_status["updateStatus"], "no_update_available")

    def test_source_links_fall_back_to_exact_github_resolution_for_legacy_entries(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            package_root = seed_skill_package(
                spec.skills_store_root,
                "agent-browser",
                "agent-browser",
                body="Shared package fixture.",
                source_kind="github",
                source_locator="github:vercel-labs/agent-browser/agent-browser",
            )
            seed_store_manifest(
                spec,
                [
                    SkillStoreEntry(
                        package_dir="agent-browser",
                        declared_name="agent-browser",
                        source_kind="github",
                        source_locator="github:vercel-labs/agent-browser/agent-browser",
                        revision=fingerprint_package(package_root)[0],
                    )
                ],
            )

            container = build_backend_container(spec.env())
            container.skills_source_fetcher._github = _StaticGitHubSource(  # type: ignore[assignment]
                package_root,
                repo="vercel-labs/agent-browser",
                ref="main",
                relative_path="skills/agent-browser",
            )
            payload = container.skills_queries.list_skills()
            shared = next(row for row in payload["rows"] if row["name"] == "agent-browser")
            detail = container.skills_queries.get_skill_detail(shared["skillRef"])

            assert detail is not None

            self.assertEqual(detail["sourceLinks"], {
                "repoLabel": "vercel-labs/agent-browser",
                "repoUrl": "https://github.com/vercel-labs/agent-browser",
                "folderUrl": "https://github.com/vercel-labs/agent-browser/tree/main/skills/agent-browser",
            })

    def test_marketplace_queries_mark_matching_managed_source_as_installed(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            package_root = seed_skill_package(
                spec.skills_store_root,
                "mode-switch",
                "Mode Switch",
                body="Managed package fixture.",
                source_kind="github",
                source_locator="github:mode-io/skills/mode-switch",
            )
            seed_store_manifest(
                spec,
                [
                    SkillStoreEntry(
                        package_dir="mode-switch",
                        declared_name="Mode Switch",
                        source_kind="github",
                        source_locator="github:mode-io/skills/mode-switch",
                        revision=fingerprint_package(package_root)[0],
                    )
                ],
            )

            container = build_backend_container(
                spec.env(),
                marketplace_catalog=create_fixture_marketplace_service(),
            )

            page = container.skills_marketplace_queries.popular_page()
            item = next(row for row in page["items"] if row["name"] == "Mode Switch")
            detail = container.skills_marketplace_queries.get_item_detail(item["id"])
            document = container.skills_marketplace_queries.get_item_document(item["id"])

            self.assertEqual(item["installation"], {
                "status": "installed",
                "installedSkillRef": "shared:mode-switch",
            })
            assert detail is not None
            assert document is not None
            self.assertEqual(detail["installation"], {
                "status": "installed",
                "installedSkillRef": "shared:mode-switch",
            })
            self.assertIn(document["status"], {"ready", "unavailable"})


class LegacyLayoutMigrationTests(unittest.TestCase):
    """Tests for _migrate_legacy_layouts covering both old shapes and agent rewriting."""

    def test_migrates_from_shared_shape(self) -> None:
        """Pre-package shape: data_dir/shared → data_dir/skills"""
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            data_dir = spec.xdg_data_home / "skill-manager"
            legacy_dir = data_dir / "shared"
            legacy_dir.mkdir(parents=True)
            (legacy_dir / "audit").mkdir()
            (legacy_dir / "audit" / "SKILL.md").write_text("---\nname: Audit\n---\nbody", encoding="utf-8")
            (legacy_dir / "trace").mkdir()
            (legacy_dir / "trace" / "SKILL.md").write_text("---\nname: Trace\n---\nbody", encoding="utf-8")

            _migrate_legacy_layouts(data_dir, spec.skills_store_root, spec.agents_root)

            self.assertTrue((spec.skills_store_root / "audit" / "SKILL.md").is_file())
            self.assertTrue((spec.skills_store_root / "trace" / "SKILL.md").is_file())
            self.assertFalse((legacy_dir / "audit").exists())
            self.assertFalse((legacy_dir / "trace").exists())

    def test_migrates_from_package_layout_shape(self) -> None:
        """Package-layout shape: data_dir/packages/local/skills → data_dir/skills"""
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            data_dir = spec.xdg_data_home / "skill-manager"
            legacy_dir = data_dir / "packages" / "local" / "skills"
            legacy_dir.mkdir(parents=True)
            (legacy_dir / "audit").mkdir()
            (legacy_dir / "audit" / "SKILL.md").write_text("---\nname: Audit\n---\nbody", encoding="utf-8")

            _migrate_legacy_layouts(data_dir, spec.skills_store_root, spec.agents_root)

            self.assertTrue((spec.skills_store_root / "audit" / "SKILL.md").is_file())

    def test_migrates_manifest_from_legacy(self) -> None:
        """Legacy manifest.json is copied to skills-manifest.json."""
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            data_dir = spec.xdg_data_home / "skill-manager"
            legacy_dir = data_dir / "shared"
            legacy_dir.mkdir(parents=True)
            (legacy_dir / "audit").mkdir()
            (legacy_dir / "audit" / "SKILL.md").write_text("---\nname: Audit\n---\nbody", encoding="utf-8")
            manifest_path = data_dir / "manifest.json"
            manifest_path.write_text('{"version":1,"entries":[]}', encoding="utf-8")

            _migrate_legacy_layouts(data_dir, spec.skills_store_root, spec.agents_root)

            target_manifest = data_dir / "skills-manifest.json"
            self.assertTrue(target_manifest.is_file())
            self.assertIn('"version"', target_manifest.read_text(encoding="utf-8"))

    def test_agent_migration_moves_files_verbatim(self) -> None:
        """Legacy agent files move to the flat store with their bytes untouched.

        The migration used to rewrite `capabilities.skills` / `.mcps` to strip a
        `local/` prefix. Those keys are no longer part of the agent model, and the
        parser ignores them, so the migration is now a plain move — rewriting
        someone's file on upgrade would be gratuitous.
        """
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            data_dir = spec.xdg_data_home / "skill-manager"
            legacy_agents = data_dir / "packages" / "local" / "agents"
            legacy_agents.mkdir(parents=True)
            agent_doc = (
                "---\n"
                "name: Chief of Staff\n"
                "description: Orchestrates tasks.\n"
                "capabilities:\n"
                "  skills:\n"
                "    - local/project-context\n"
                "  mcps:\n"
                "    - local/github-mcp\n"
                "---\n\n"
                "You are a chief of staff.\n"
            )
            (legacy_agents / "chief-of-staff.md").write_text(agent_doc, encoding="utf-8")

            _migrate_legacy_layouts(data_dir, spec.skills_store_root, spec.agents_root)

            migrated = spec.agents_root / "chief-of-staff.md"
            self.assertTrue(migrated.is_file())
            self.assertEqual(migrated.read_text(encoding="utf-8"), agent_doc)

            # And it still parses under the current model, legacy keys and all.
            agent = parse_agent_file(migrated)
            self.assertEqual(agent.name, "Chief of Staff")
            self.assertEqual(agent.description, "Orchestrates tasks.")
            self.assertEqual(agent.prompt, "You are a chief of staff.")


if __name__ == "__main__":
    unittest.main()
