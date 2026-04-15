from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from skill_manager.application import build_backend_container
from skill_manager.domain import fingerprint_package
from skill_manager.sources import ResolvedGitHubSkill
from skill_manager.store import ManifestEntry

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


class BackendContainerTests(unittest.TestCase):
    def test_list_skills_groups_identical_local_copies_and_preserves_builtins(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            seed_mixed_fixture(spec)
            container = build_backend_container(spec.env())
            payload = container.skills_queries.list_skills()

            trace_lens = next(row for row in payload["rows"] if row["name"] == "Trace Lens")
            self.assertEqual(trace_lens["displayStatus"], "Unmanaged")
            self.assertEqual(
                {cell["harness"] for cell in trace_lens["cells"] if cell["state"] == "found"},
                {"codex", "claude", "opencode"},
            )

            builtin = next(row for row in payload["rows"] if row["name"] == "Review Helper")
            self.assertEqual(builtin["displayStatus"], "Built-in")
            self.assertNotIn("isBuiltin", trace_lens)

    def test_detail_and_source_status_are_split(self) -> None:
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

            container = build_backend_container(spec.env())
            payload = container.skills_queries.list_skills()
            audit = next(row for row in payload["rows"] if row["name"] == "Audit Skill")
            detail = container.skills_queries.get_skill_detail(audit["skillRef"])
            source_status = container.skills_queries.get_skill_source_status(audit["skillRef"])

            assert detail is not None
            assert source_status is not None

            self.assertEqual(detail["displayStatus"], "Custom")
            self.assertEqual(detail["attentionMessage"], "Modified locally; source updates are disabled.")
            self.assertNotIn("updateStatus", detail["actions"])
            self.assertEqual(source_status["updateStatus"], "no_source_available")
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

            self.assertEqual(len(settings["harnesses"]), 5)
            codex = next(item for item in settings["harnesses"] if item["harness"] == "codex")
            self.assertIn("managedLocation", codex)
            self.assertIn("installed", codex)
            self.assertNotIn("discoveryMode", codex)
            self.assertNotIn("centralStore", settings)
            self.assertNotIn("topology", settings)

    def test_skill_detail_exposes_document_markdown_for_local_and_shared_skills(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            seed_mixed_fixture(spec)
            container = build_backend_container(spec.env())

            payload = container.skills_queries.list_skills()
            shared = next(row for row in payload["rows"] if row["name"] == "Shared Audit")
            found = next(row for row in payload["rows"] if row["name"] == "Trace Lens")
            builtin = next(row for row in payload["rows"] if row["name"] == "Review Helper")

            shared_detail = container.skills_queries.get_skill_detail(shared["skillRef"])
            found_detail = container.skills_queries.get_skill_detail(found["skillRef"])
            builtin_detail = container.skills_queries.get_skill_detail(builtin["skillRef"])

            assert shared_detail is not None
            assert found_detail is not None
            assert builtin_detail is not None

            self.assertIn("Shared package fixture.", shared_detail["documentMarkdown"])
            self.assertIn("trace", found_detail["documentMarkdown"])
            self.assertIsNone(builtin_detail["documentMarkdown"])
            self.assertNotIn("advanced", shared_detail)
            self.assertEqual(shared_detail["actions"]["stopManagingStatus"], "disabled_no_enabled")
            self.assertEqual(shared_detail["actions"]["stopManagingHarnessLabels"], [])
            self.assertIsNone(found_detail["actions"]["stopManagingStatus"])
            self.assertIsNone(builtin_detail["actions"]["stopManagingStatus"])
            self.assertEqual(
                [cell["state"] for cell in builtin_detail["harnessCells"]],
                ["empty", "empty", "empty", "builtin", "empty"],
            )

    def test_skill_detail_orders_managed_locations_with_shared_store_first(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            seed_managed_linked_fixture(spec)
            container = build_backend_container(spec.env())

            payload = container.skills_queries.list_skills()
            shared = next(row for row in payload["rows"] if row["name"] == "Shared Audit")
            detail = container.skills_queries.get_skill_detail(shared["skillRef"])

            assert detail is not None

            self.assertEqual([location["label"] for location in detail["locations"]], ["Shared Store", "Codex", "OpenClaw", "OpenCode"])
            self.assertEqual(detail["locations"][0]["path"], str(spec.shared_store_root / "shared-audit"))
            self.assertEqual(detail["locations"][1]["path"], str(spec.codex_root / "shared-audit"))
            self.assertEqual(detail["actions"]["stopManagingStatus"], "available")
            self.assertEqual(detail["actions"]["stopManagingHarnessLabels"], ["Codex"])

    def test_source_links_use_persisted_exact_folder_url(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            package_root = seed_skill_package(
                spec.shared_store_root,
                "shared-audit",
                "Shared Audit",
                body="Shared package fixture.",
                source_kind="github",
                source_locator="github:mode-io/skills/shared-audit",
            )
            seed_store_manifest(
                spec,
                [
                    ManifestEntry(
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
                spec.shared_store_root,
                "agent-browser",
                "agent-browser",
                body="Shared package fixture.",
                source_kind="github",
                source_locator="github:vercel-labs/agent-browser/agent-browser",
            )
            seed_store_manifest(
                spec,
                [
                    ManifestEntry(
                        package_dir="agent-browser",
                        declared_name="agent-browser",
                        source_kind="github",
                        source_locator="github:vercel-labs/agent-browser/agent-browser",
                        revision=fingerprint_package(package_root)[0],
                    )
                ],
            )

            container = build_backend_container(spec.env())
            container.source_fetcher._github = _StaticGitHubSource(  # type: ignore[assignment]
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
                spec.shared_store_root,
                "mode-switch",
                "Mode Switch",
                body="Managed package fixture.",
                source_kind="github",
                source_locator="github:mode-io/skills/mode-switch",
            )
            seed_store_manifest(
                spec,
                [
                    ManifestEntry(
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

            page = container.marketplace_queries.popular_page()
            item = next(row for row in page["items"] if row["name"] == "Mode Switch")
            detail = container.marketplace_queries.get_item_detail(item["id"])
            document = container.marketplace_queries.get_item_document(item["id"])

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


if __name__ == "__main__":
    unittest.main()
