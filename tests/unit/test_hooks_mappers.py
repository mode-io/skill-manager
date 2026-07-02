from __future__ import annotations

import unittest
from skill_manager.application.hooks.mappers import (
    ClaudeCodeHooksMapper,
    CodexHooksMapper,
    CursorHooksMapper,
    OpenCodeHooksMapper,
    AntigravityHooksMapper,
)
from skill_manager.application.hooks.store import HookSpec
from skill_manager.errors import MutationError


class ClaudeCodeHooksMapperTests(unittest.TestCase):
    def test_representable(self) -> None:
        mapper = ClaudeCodeHooksMapper()
        # Supported event and match
        is_repr, _, _ = mapper.representable(HookSpec("h1", "pre_tool_use", "echo", match="shell"))
        self.assertTrue(is_repr)
        # Unsupported event
        is_repr, _, _ = mapper.representable(HookSpec("h1", "invalid_event", "echo"))
        self.assertFalse(is_repr)
        # Unsupported match
        is_repr, _, _ = mapper.representable(HookSpec("h1", "pre_tool_use", "echo", match="invalid_match"))
        self.assertFalse(is_repr)

    def test_spec_to_dict_and_dict_to_spec(self) -> None:
        mapper = ClaudeCodeHooksMapper()
        spec = HookSpec("h1", "pre_tool_use", "echo hello", match="shell", timeout=12)
        
        # Spec to dict
        d = mapper.spec_to_dict(spec)
        self.assertEqual(d["type"], "command")
        self.assertEqual(d["command"], "echo hello")
        self.assertEqual(d["id"], "h1")
        self.assertEqual(d["timeout"], 12)

        # Dict to spec
        parsed = mapper.dict_to_spec("pre_tool_use", "shell", d)
        self.assertEqual(parsed.id, "h1")
        self.assertEqual(parsed.event, "pre_tool_use")
        self.assertEqual(parsed.match, "shell")
        self.assertEqual(parsed.command, "echo hello")
        self.assertEqual(parsed.timeout, 12)

    def test_read_enable_disable_lifecycle(self) -> None:
        mapper = ClaudeCodeHooksMapper()
        doc = {}
        spec = HookSpec("h1", "pre_tool_use", "echo hello", match="shell")
        
        # Enable
        mapper.enable_hook(doc, spec)
        self.assertIn("hooks", doc)
        self.assertIn("PreToolUse", doc["hooks"])
        group = doc["hooks"]["PreToolUse"][0]
        self.assertEqual(group["matcher"], "Bash")
        self.assertEqual(group["hooks"][0]["command"], "echo hello")

        # Read
        entries = mapper.read_entries(doc, [spec])
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0].id, "h1")
        self.assertEqual(entries[0].event, "pre_tool_use")
        self.assertEqual(entries[0].match, "shell")

        # Disable
        mapper.disable_hook(doc, "h1")
        self.assertNotIn("hooks", doc)


class CodexHooksMapperTests(unittest.TestCase):
    def test_representable(self) -> None:
        mapper = CodexHooksMapper()
        is_repr, _, _ = mapper.representable(HookSpec("h1", "pre_tool_use", "echo", match="shell"))
        self.assertTrue(is_repr)
        is_repr, _, _ = mapper.representable(HookSpec("h1", "invalid_event", "echo"))
        self.assertFalse(is_repr)


class CursorHooksMapperTests(unittest.TestCase):
    def test_representable(self) -> None:
        mapper = CursorHooksMapper()
        # Shell is representable
        is_repr, _, _ = mapper.representable(HookSpec("h1", "pre_tool_use", "echo", match="shell"))
        self.assertTrue(is_repr)
        # Web is not representable on Cursor
        is_repr, _, _ = mapper.representable(HookSpec("h1", "pre_tool_use", "echo", match="web"))
        self.assertFalse(is_repr)

    def test_enable_and_read_event_mapping(self) -> None:
        mapper = CursorHooksMapper()
        doc = {}
        spec = HookSpec("h1", "pre_tool_use", "echo hello", match="shell")
        
        # Enable maps (pre_tool_use, shell) -> beforeShellExecution
        mapper.enable_hook(doc, spec)
        self.assertEqual(doc["version"], 1)
        self.assertIn("beforeShellExecution", doc["hooks"])
        self.assertEqual(doc["hooks"]["beforeShellExecution"][0]["command"], "echo hello")

        # Read resolves ID
        entries = mapper.read_entries(doc, [spec])
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0].id, "h1")
        self.assertEqual(entries[0].event, "pre_tool_use")
        self.assertEqual(entries[0].match, "shell")

    def test_id_by_hash_identity_for_unmanaged(self) -> None:
        mapper = CursorHooksMapper()
        doc = {
            "version": 1,
            "hooks": {
                "beforeShellExecution": [
                    {"command": "echo unmanaged"}
                ]
            }
        }
        # Read without spec resolves to manual:<hash>
        entries = mapper.read_entries(doc, [])
        self.assertEqual(len(entries), 1)
        self.assertTrue(entries[0].id.startswith("manual:"))

        # Disable by hash ID
        mapper.disable_hook(doc, entries[0].id)
        self.assertNotIn("hooks", doc)


class OpenCodeHooksMapperTests(unittest.TestCase):
    def test_representable(self) -> None:
        mapper = OpenCodeHooksMapper()
        # Stop is representable
        is_repr, _, _ = mapper.representable(HookSpec("h1", "stop", "echo"))
        self.assertTrue(is_repr)
        # file_write is representable under post_tool_use
        is_repr, _, _ = mapper.representable(HookSpec("h1", "post_tool_use", "echo", match="file_write"))
        self.assertTrue(is_repr)
        # shell is not representable on OpenCode
        is_repr, _, _ = mapper.representable(HookSpec("h1", "pre_tool_use", "echo", match="shell"))
        self.assertFalse(is_repr)

    def test_enable_argv_wrapping_and_read(self) -> None:
        mapper = OpenCodeHooksMapper()
        doc = {}
        spec = HookSpec("h1", "stop", "echo hello")

        # Enable wraps command in ["/bin/sh", "-c", command]
        mapper.enable_hook(doc, spec)
        session_completed = doc["experimental"]["hook"]["session_completed"]
        self.assertEqual(session_completed[0]["command"], ["/bin/sh", "-c", "echo hello"])

        # Read unwraps argv array to command string
        entries = mapper.read_entries(doc, [spec])
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0].id, "h1")
        self.assertEqual(entries[0].event, "stop")
        self.assertEqual(entries[0].payload["command"], ["/bin/sh", "-c", "echo hello"])


class AntigravityHooksMapperTests(unittest.TestCase):
    def test_representable(self) -> None:
        mapper = AntigravityHooksMapper()
        # stop is representable
        is_repr, _, _ = mapper.representable(HookSpec("h1", "stop", "echo"))
        self.assertTrue(is_repr)
        # shell is representable
        is_repr, _, _ = mapper.representable(HookSpec("h1", "pre_tool_use", "echo", match="shell"))
        self.assertTrue(is_repr)
        # mcp is not representable
        is_repr, _, _ = mapper.representable(HookSpec("h1", "pre_tool_use", "echo", match="mcp"))
        self.assertFalse(is_repr)

    def test_enable_name_keyed_merge_and_read(self) -> None:
        mapper = AntigravityHooksMapper()
        doc = {}
        spec = HookSpec("my-hook-id", "stop", "echo hello")

        # Enable stores under top-level spec.id
        mapper.enable_hook(doc, spec)
        self.assertIn("my-hook-id", doc)
        self.assertTrue(doc["my-hook-id"]["enabled"])
        self.assertEqual(doc["my-hook-id"]["Stop"][0]["command"], "echo hello")

        # Read
        entries = mapper.read_entries(doc, [spec])
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0].id, "my-hook-id")
        self.assertEqual(entries[0].event, "stop")

        # Disable
        mapper.disable_hook(doc, "my-hook-id")
        self.assertNotIn("my-hook-id", doc)

    def test_representable_caveat(self) -> None:
        mapper = AntigravityHooksMapper()
        is_repr, reason, caveat = mapper.representable(HookSpec("h1", "user_prompt_submit", "echo"))
        self.assertTrue(is_repr)
        self.assertIsNone(reason)
        self.assertEqual(
            caveat,
            "On Antigravity this maps to PreInvocation, which fires before every model invocation, not only on user-prompt submit."
        )

    def test_preinvocation_round_trip(self) -> None:
        mapper = AntigravityHooksMapper()
        doc = {}
        spec = HookSpec("user-hook", "user_prompt_submit", "echo 'hello world'", timeout=45)

        # Enable hook
        mapper.enable_hook(doc, spec)
        self.assertIn("user-hook", doc)
        self.assertTrue(doc["user-hook"]["enabled"])
        self.assertIn("PreInvocation", doc["user-hook"])
        self.assertEqual(doc["user-hook"]["PreInvocation"][0]["command"], "echo 'hello world'")
        self.assertEqual(doc["user-hook"]["PreInvocation"][0]["timeout"], 45)

        # Read back
        entries = mapper.read_entries(doc, [spec])
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0].id, "user-hook")
        self.assertEqual(entries[0].event, "user_prompt_submit")
        self.assertIsNone(entries[0].match)
        self.assertEqual(entries[0].payload["command"], "echo 'hello world'")

        # Disable hook
        mapper.disable_hook(doc, "user-hook")
        self.assertNotIn("user-hook", doc)

    def test_foreign_preservation(self) -> None:
        mapper = AntigravityHooksMapper()
        doc = {
            "foreign-hook": {
                "enabled": True,
                "PreToolUse": [
                    {
                        "matcher": "*",
                        "hooks": [{"type": "command", "command": "echo foreign"}]
                    }
                ]
            }
        }
        spec = HookSpec("user-hook", "user_prompt_submit", "echo 'hello'")
        mapper.enable_hook(doc, spec)

        self.assertIn("foreign-hook", doc)
        self.assertIn("user-hook", doc)
        self.assertEqual(doc["foreign-hook"]["PreToolUse"][0]["hooks"][0]["command"], "echo foreign")
        self.assertEqual(doc["user-hook"]["PreInvocation"][0]["command"], "echo 'hello'")


if __name__ == "__main__":
    unittest.main()
