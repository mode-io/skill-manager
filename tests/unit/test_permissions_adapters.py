from __future__ import annotations

import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.application.permissions.adapters import FileBackedPermissionsAdapter
from skill_manager.application.permissions.store import PermissionSpec, PermissionStore
from skill_manager.errors import MutationError
from skill_manager.harness import HarnessKernelService, HarnessSupportStore


def _spec(id: str = "test-perm", **overrides) -> PermissionSpec:
    base = dict(
        id=id,
        decision="allow",
        scope="shell",
        pattern="git push",
        description="A test permission",
    )
    base.update(overrides)
    return PermissionSpec(**base)


def _adapter(
    harness: str,
    *,
    home: Path,
) -> FileBackedPermissionsAdapter:
    env = {
        "HOME": str(home),
        "PATH": "",
    }
    kernel = HarnessKernelService.from_environment(
        env,
        support_store=HarnessSupportStore(home / "settings.json"),
    )
    binding = next(
        binding for binding in kernel.bindings_for_family("permissions") if binding.definition.harness == harness
    )
    return FileBackedPermissionsAdapter(
        definition=binding.definition,
        profile=binding.profile,
        context=kernel.context,
    )


class FileBackedPermissionsAdapterTests(unittest.TestCase):
    def test_classifies_managed_when_content_matches(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = PermissionStore(home / "manifest.json")
            store.upsert_managed(_spec("perm1"))
            adapter = _adapter("claude", home=home)

            adapter.enable_permission(store.get_managed("perm1"))  # type: ignore[arg-type]
            scan = adapter.scan(store.list_managed())

            states = {entry.id: entry.state for entry in scan.entries}
            self.assertEqual(states.get("perm1"), "managed")

    def test_classifies_drifted_when_user_edits_entry(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = PermissionStore(home / "manifest.json")
            store.upsert_managed(_spec("perm1"))
            adapter = _adapter("claude", home=home)
            adapter.config_path.parent.mkdir(parents=True, exist_ok=True)
            adapter.config_path.write_text(
                json.dumps(
                    {
                        "permissions": {
                            "deny": [
                                "Bash(git push)" # user drifted decision to deny
                            ]
                        }
                    }
                ),
                encoding="utf-8",
            )

            scan = adapter.scan(store.list_managed())
            states = {entry.id: entry.state for entry in scan.entries}
            self.assertEqual(states.get("perm1"), "drifted")

    def test_claude_file_write_round_trip_and_drift(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = PermissionStore(home / "manifest.json")
            spec = _spec("p-write", scope="file_write", pattern="~/.zshrc")
            store.upsert_managed(spec)
            
            adapter = _adapter("claude", home=home)
            adapter.enable_permission(spec)
            
            # Should have written both Edit and Write
            scan = adapter.scan(store.list_managed())
            states = {entry.id: entry.state for entry in scan.entries}
            self.assertEqual(states.get("p-write"), "managed")
            
            # Modify to only have Edit (drift)
            adapter.config_path.write_text(
                json.dumps({
                    "permissions": {
                        "allow": ["Edit(~/.zshrc)"]
                    }
                }),
                encoding="utf-8"
            )
            scan_drift = adapter.scan(store.list_managed())
            self.assertEqual({entry.id: entry.state for entry in scan_drift.entries}.get("p-write"), "drifted")

    def test_antigravity_round_trip_and_unsupported(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = PermissionStore(home / "manifest.json")
            spec_shell = _spec("p-shell", scope="shell", pattern="git push")
            spec_file = _spec("p-file", scope="file_read", pattern="~/.zshrc")
            store.upsert_managed(spec_shell)
            store.upsert_managed(spec_file)

            adapter = _adapter("agy", home=home)
            
            # Enable shell should work
            adapter.enable_permission(spec_shell)
            
            # Enable file_read should fail as unsupported
            with self.assertRaises(MutationError) as ctx:
                adapter.enable_permission(spec_file)
            self.assertIn("Permission not supported on Antigravity", str(ctx.exception))

            scan = adapter.scan(store.list_managed())
            states = {entry.id: entry.state for entry in scan.entries}
            self.assertEqual(states.get("p-shell"), "managed")
            self.assertEqual(states.get("p-file"), "unsupported")

    def test_codex_round_trip_unsupported_and_preservation(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = PermissionStore(home / "manifest.json")
            spec_file = _spec("p-file", scope="file_read", pattern="~/.zshrc")
            spec_shell = _spec("p-shell", scope="shell", pattern="git push")
            store.upsert_managed(spec_file)
            store.upsert_managed(spec_shell)

            adapter = _adapter("codex", home=home)
            
            # Enable file_read should work
            adapter.enable_permission(spec_file)
            
            # Enable shell should fail
            with self.assertRaises(MutationError) as ctx:
                adapter.enable_permission(spec_shell)
            self.assertIn("Permission not supported on Codex", str(ctx.exception))

            # Seed user profile
            adapter.config_path.write_text(
                "[permissions.user-profile]\nextends = \":read-only\"\n[permissions.skill-manager.filesystem]\n\"~/.zshrc\" = \"read\"\n",
                encoding="utf-8"
            )

            scan = adapter.scan(store.list_managed())
            states = {entry.id: entry.state for entry in scan.entries}
            self.assertEqual(states.get("p-file"), "managed")
            self.assertEqual(states.get("p-shell"), "unsupported")

            # Enable file_read again - should preserve user profile
            adapter.enable_permission(spec_file)
            text = adapter.config_path.read_text(encoding="utf-8")
            self.assertIn("[permissions.user-profile]", text)
            self.assertIn("[permissions.skill-manager.filesystem]", text)

    def test_pressure_test_malformed_config_and_user_profile(self) -> None:
        """Feed a malformed permission config of each format (JSON + TOML) AND a pre-existing

        user-authored rule/profile, and prove the adapter neither crashes nor clobbers foreign data.
        """
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = PermissionStore(home / "manifest.json")
            spec = _spec("p-shell", scope="shell", pattern="git push")
            store.upsert_managed(spec)

            # 1) JSON Format (Claude Code settings.json)
            adapter_claude = _adapter("claude", home=home)
            adapter_claude.config_path.parent.mkdir(parents=True, exist_ok=True)
            # Pre-existing user-authored key/data AND malformed JSON
            adapter_claude.config_path.write_text('{"theme": "dark", "permissions": { "allow": ["Bash(git push)"] }, "malformed": {', encoding="utf-8")

            # Scan should not crash, but report scan issue
            scan_claude = adapter_claude.scan(store.list_managed())
            self.assertIsNotNone(scan_claude.scan_issue)
            self.assertIn("not valid JSON", scan_claude.scan_issue)

            # Enabling on malformed config raises MutationError (does not crash or silent overwrite)
            with self.assertRaises(MutationError):
                adapter_claude.enable_permission(spec)

            # Fix JSON syntax but keep foreign keys, then enable
            adapter_claude.config_path.write_text('{"theme": "dark", "permissions": { "allow": [] }}', encoding="utf-8")
            adapter_claude.enable_permission(spec)
            
            # Confirm foreign key "theme" is preserved
            doc_claude = json.loads(adapter_claude.config_path.read_text(encoding="utf-8"))
            self.assertEqual(doc_claude.get("theme"), "dark")
            self.assertIn("Bash(git push)", doc_claude["permissions"]["allow"])

            # 2) TOML Format (Codex config.toml)
            adapter_codex = _adapter("codex", home=home)
            adapter_codex.config_path.parent.mkdir(parents=True, exist_ok=True)
            # Pre-existing user-authored rule AND malformed TOML
            adapter_codex.config_path.write_text("[permissions.user-profile]\nextends = \":read-only\"\n[malformed_table\nkey = ", encoding="utf-8")

            # Scan should not crash, but report scan issue
            scan_codex = adapter_codex.scan(store.list_managed())
            self.assertIsNotNone(scan_codex.scan_issue)
            self.assertIn("not valid TOML", scan_codex.scan_issue)

            # Enabling on malformed TOML raises MutationError
            spec_file = _spec("p-file", scope="file_read", pattern="~/.zshrc")
            with self.assertRaises(MutationError):
                adapter_codex.enable_permission(spec_file)

            # Fix TOML but keep user profile, then enable
            adapter_codex.config_path.write_text("[permissions.user-profile]\nextends = \":read-only\"\nfilesystem = { \"~/.bashrc\" = \"read\" }\n", encoding="utf-8")
            adapter_codex.enable_permission(spec_file)

            # Confirm user-profile is preserved
            text_codex = adapter_codex.config_path.read_text(encoding="utf-8")
            self.assertIn("[permissions.user-profile]", text_codex)
            self.assertIn("~/.bashrc", text_codex)
            self.assertIn("~/.zshrc", text_codex)


if __name__ == "__main__":
    unittest.main()
