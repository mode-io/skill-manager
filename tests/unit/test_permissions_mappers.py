from __future__ import annotations

import unittest

from skill_manager.application.permissions.mappers import (
    AntigravityPermissionsMapper,
    ClaudeCodePermissionsMapper,
    CodexPermissionsMapper,
)
from skill_manager.application.permissions.store import PermissionSpec
from skill_manager.errors import MutationError


class ClaudeCodePermissionsMapperTests(unittest.TestCase):
    def test_representable(self) -> None:
        mapper = ClaudeCodePermissionsMapper()
        # Supported decision, scope, and pattern
        is_repr, _, _ = mapper.representable(PermissionSpec("p1", "allow", "shell", "git push"))
        self.assertTrue(is_repr)
        # Unsupported decision
        is_repr, _, _ = mapper.representable(PermissionSpec("p1", "invalid_decision", "shell", "git push"))
        self.assertFalse(is_repr)
        # Unsupported scope
        is_repr, _, _ = mapper.representable(PermissionSpec("p1", "allow", "any", "git push"))
        self.assertFalse(is_repr)

    def test_file_write_dual_rule_round_trip_and_drift(self) -> None:
        mapper = ClaudeCodePermissionsMapper()
        doc = {}
        spec = PermissionSpec("p-write", "allow", "file_write", "~/.zshrc")

        # Enable - must write both Edit and Write rules
        mapper.enable_permission(doc, spec)
        self.assertIn("permissions", doc)
        self.assertIn("allow", doc["permissions"])
        rules = doc["permissions"]["allow"]
        self.assertIn("Edit(~/.zshrc)", rules)
        self.assertIn("Write(~/.zshrc)", rules)

        # Read back
        entries = mapper.read_entries(doc, [spec])
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0].id, "p-write")
        self.assertEqual(entries[0].decision, "allow")
        self.assertEqual(entries[0].scope, "file_write")
        self.assertEqual(entries[0].pattern, "~/.zshrc")
        self.assertEqual(sorted(entries[0].payload["rules"]), ["Edit(~/.zshrc)", "Write(~/.zshrc)"])

        # Drift case: only Edit(~/.zshrc) is present, Write is missing
        doc_drifted = {
            "permissions": {
                "allow": ["Edit(~/.zshrc)"]
            }
        }
        entries_drifted = mapper.read_entries(doc_drifted, [spec])
        self.assertEqual(len(entries_drifted), 1)
        self.assertEqual(entries_drifted[0].id, "p-write")
        self.assertEqual(entries_drifted[0].payload["rules"], ["Edit(~/.zshrc)"])
        # In adapters.py, this will compare expected ['Edit(~/.zshrc)', 'Write(~/.zshrc)'] with actual ['Edit(~/.zshrc)'] and flag drift.

        # Disable
        mapper.disable_permission(doc, "p-write", "~/.zshrc")
        self.assertNotIn("permissions", doc)


class AntigravityPermissionsMapperTests(unittest.TestCase):
    def test_representable(self) -> None:
        mapper = AntigravityPermissionsMapper()
        # Supported shell and mcp
        self.assertTrue(mapper.representable(PermissionSpec("p1", "allow", "shell", "git push"))[0])
        self.assertTrue(mapper.representable(PermissionSpec("p2", "allow", "mcp", "server/tool"))[0])
        
        # Unsupported file/web
        is_repr, reason, _ = mapper.representable(PermissionSpec("p3", "allow", "file_read", "~/.zshrc"))
        self.assertFalse(is_repr)
        self.assertEqual(reason, "Scope 'file_read' is not supported by Antigravity")
        
        is_repr, reason, _ = mapper.representable(PermissionSpec("p4", "allow", "web", "example.com"))
        self.assertFalse(is_repr)
        self.assertEqual(reason, "Scope 'web' is not supported by Antigravity")

    def test_round_trip_shell_and_mcp(self) -> None:
        mapper = AntigravityPermissionsMapper()
        doc = {}
        spec_shell = PermissionSpec("p-shell", "allow", "shell", "git push")
        spec_mcp = PermissionSpec("p-mcp", "deny", "mcp", "server/tool")

        # Enable shell
        mapper.enable_permission(doc, spec_shell)
        self.assertIn("permissions", doc)
        self.assertEqual(doc["permissions"]["allow"], ["command(git push)"])

        # Enable mcp
        mapper.enable_permission(doc, spec_mcp)
        self.assertEqual(doc["permissions"]["deny"], ["mcp(server/tool)"])

        # Read back
        entries = mapper.read_entries(doc, [spec_shell, spec_mcp])
        self.assertEqual(len(entries), 2)
        
        # Disable
        mapper.disable_permission(doc, "p-shell", "git push")
        self.assertNotIn("allow", doc["permissions"])
        self.assertIn("deny", doc["permissions"])


class CodexPermissionsMapperTests(unittest.TestCase):
    def test_representable(self) -> None:
        mapper = CodexPermissionsMapper()
        
        # Supported file_read, file_write, web
        self.assertTrue(mapper.representable(PermissionSpec("p1", "allow", "file_read", "~/.zshrc"))[0])
        self.assertTrue(mapper.representable(PermissionSpec("p2", "allow", "file_write", "~/.zshrc"))[0])
        self.assertTrue(mapper.representable(PermissionSpec("p3", "allow", "web", "api.example.com"))[0])

        # Unsupported decision ask
        is_repr, reason, _ = mapper.representable(PermissionSpec("p4", "ask", "file_read", "~/.zshrc"))
        self.assertFalse(is_repr)
        self.assertEqual(reason, "Codex does not support ask decision for rules")

        # Unsupported shell / mcp with caveat
        is_repr, reason, caveat = mapper.representable(PermissionSpec("p5", "allow", "shell", "git push"))
        self.assertFalse(is_repr)
        self.assertEqual(caveat, "sandbox/approval govern shell")

        is_repr, reason, caveat = mapper.representable(PermissionSpec("p6", "allow", "mcp", "server/tool"))
        self.assertFalse(is_repr)
        self.assertEqual(caveat, "config.toml has no MCP allowlist")

    def test_round_trip(self) -> None:
        mapper = CodexPermissionsMapper()
        doc = {}
        spec_read = PermissionSpec("p-read", "allow", "file_read", "~/.zshrc")
        spec_write = PermissionSpec("p-write", "allow", "file_write", "./secrets/**")
        spec_deny = PermissionSpec("p-deny", "deny", "file_read", "/etc/passwd")
        spec_web = PermissionSpec("p-web", "allow", "web", "api.example.com")

        # Enable all
        mapper.enable_permission(doc, spec_read)
        mapper.enable_permission(doc, spec_write)
        mapper.enable_permission(doc, spec_deny)
        mapper.enable_permission(doc, spec_web)

        profile = doc["permissions"]["skill-manager"]
        self.assertEqual(profile["extends"], ":read-only")
        self.assertEqual(profile["filesystem"]["~/.zshrc"], "read")
        self.assertEqual(profile["filesystem"]["./secrets/**"], "write")
        self.assertEqual(profile["filesystem"]["/etc/passwd"], "deny")
        self.assertEqual(profile["network"]["enabled"], True)
        self.assertEqual(profile["network"]["mode"], "allow")
        self.assertEqual(profile["network"]["domains"]["api.example.com"], "allow")

        # Read back
        entries = mapper.read_entries(doc, [spec_read, spec_write, spec_deny, spec_web])
        self.assertEqual(len(entries), 4)

        # Disable one by one
        mapper.disable_permission(doc, "p-read", "~/.zshrc")
        self.assertNotIn("~/.zshrc", doc["permissions"]["skill-manager"]["filesystem"])

        mapper.disable_permission(doc, "p-web", "api.example.com")
        self.assertNotIn("network", doc["permissions"]["skill-manager"])

    def test_user_authored_profile_preservation(self) -> None:
        mapper = CodexPermissionsMapper()
        # Seed user authored profile and other keys
        doc = {
            "permissions": {
                "user-profile": {
                    "extends": ":read-only",
                    "filesystem": {
                        "~/.bashrc": "read"
                    }
                }
            }
        }

        spec = PermissionSpec("p-read", "allow", "file_read", "~/.zshrc")
        mapper.enable_permission(doc, spec)

        # The skill-manager profile should be created, and user-profile preserved
        self.assertIn("skill-manager", doc["permissions"])
        self.assertIn("user-profile", doc["permissions"])
        self.assertEqual(doc["permissions"]["user-profile"]["filesystem"]["~/.bashrc"], "read")

        # Disable managed permission
        mapper.disable_permission(doc, "p-read", "~/.zshrc")
        
        # skill-manager profile should be cleaned up, user-profile preserved
        self.assertNotIn("skill-manager", doc["permissions"])
        self.assertIn("user-profile", doc["permissions"])
        self.assertEqual(doc["permissions"]["user-profile"]["filesystem"]["~/.bashrc"], "read")


if __name__ == "__main__":
    unittest.main()
