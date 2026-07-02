from __future__ import annotations

import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.application.hooks.adapters import FileBackedHooksAdapter
from skill_manager.application.hooks.store import HookSpec, HookStore
from skill_manager.errors import MutationError
from skill_manager.harness import HarnessKernelService, HarnessSupportStore


def _spec(id: str = "test-hook", **overrides) -> HookSpec:
    base = dict(
        id=id,
        event="pre_tool_use",
        command="echo hello",
        match="shell",
        timeout=30,
        description="A test hook",
    )
    base.update(overrides)
    return HookSpec(**base)


def _adapter(
    harness: str,
    *,
    home: Path,
) -> FileBackedHooksAdapter:
    env = {
        "HOME": str(home),
        "PATH": "",
    }
    kernel = HarnessKernelService.from_environment(
        env,
        support_store=HarnessSupportStore(home / "settings.json"),
    )
    binding = next(
        binding for binding in kernel.bindings_for_family("hooks") if binding.definition.harness == harness
    )
    return FileBackedHooksAdapter(
        definition=binding.definition,
        profile=binding.profile,
        context=kernel.context,
    )


class FileBackedHooksAdapterTests(unittest.TestCase):
    def test_classifies_managed_when_content_matches(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = HookStore(home / "manifest.json")
            store.upsert_managed(_spec("hook1"))
            adapter = _adapter("claude", home=home)

            adapter.enable_hook(store.get_managed("hook1"))  # type: ignore[arg-type]
            scan = adapter.scan(store.list_managed())

            states = {entry.id: entry.state for entry in scan.entries}
            self.assertEqual(states.get("hook1"), "managed")

    def test_classifies_drifted_when_user_edits_entry(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = HookStore(home / "manifest.json")
            store.upsert_managed(_spec("hook1"))
            adapter = _adapter("claude", home=home)
            adapter.config_path.parent.mkdir(parents=True, exist_ok=True)
            adapter.config_path.write_text(
                json.dumps(
                    {
                        "hooks": {
                            "PreToolUse": [
                                {
                                    "matcher": "Bash",
                                    "hooks": [
                                        {
                                            "type": "command",
                                            "command": "echo modified",
                                            "id": "hook1",
                                        }
                                    ],
                                }
                            ]
                        }
                    }
                ),
                encoding="utf-8",
            )

            scan = adapter.scan(store.list_managed())
            states = {entry.id: entry.state for entry in scan.entries}
            self.assertEqual(states.get("hook1"), "drifted")

    def test_classifies_unmanaged_when_no_central_spec(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = HookStore(home / "manifest.json")
            adapter = _adapter("claude", home=home)
            adapter.config_path.parent.mkdir(parents=True, exist_ok=True)
            adapter.config_path.write_text(
                json.dumps(
                    {
                        "hooks": {
                            "PreToolUse": [
                                {
                                    "matcher": "Bash",
                                    "hooks": [
                                        {
                                            "type": "command",
                                            "command": "echo unmanaged",
                                            "id": "legacy-hook",
                                        }
                                    ],
                                }
                            ]
                        }
                    }
                ),
                encoding="utf-8",
            )

            scan = adapter.scan(store.list_managed())
            unmanaged = [entry for entry in scan.entries if entry.state == "unmanaged"]
            self.assertEqual(len(unmanaged), 1)
            self.assertEqual(unmanaged[0].id, "legacy-hook")

    def test_managed_spec_with_no_binding_is_missing(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = HookStore(home / "manifest.json")
            store.upsert_managed(_spec("hook1"))
            adapter = _adapter("claude", home=home)
            adapter.config_path.parent.mkdir(parents=True, exist_ok=True)
            adapter.config_path.write_text(json.dumps({"hooks": {}}), encoding="utf-8")

            scan = adapter.scan(store.list_managed())
            states = {entry.id: entry.state for entry in scan.entries}
            self.assertEqual(states.get("hook1"), "missing")

    def test_enable_preserves_non_hooks_keys_for_json(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            adapter = _adapter("claude", home=home)
            adapter.config_path.parent.mkdir(parents=True, exist_ok=True)
            adapter.config_path.write_text(
                json.dumps(
                    {
                        "theme": "dark",
                        "hooks": {
                            "PreToolUse": [
                                {
                                    "matcher": "Bash",
                                    "hooks": [
                                        {"type": "command", "command": "echo existing", "id": "existing"}
                                    ],
                                }
                            ]
                        },
                    }
                ),
                encoding="utf-8",
            )

            adapter.enable_hook(_spec("hook1"))
            payload = json.loads(adapter.config_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["theme"], "dark")
            
            groups = payload["hooks"]["PreToolUse"]
            self.assertEqual(len(groups), 1)
            self.assertEqual(groups[0]["matcher"], "Bash")
            hooks = groups[0]["hooks"]
            self.assertEqual(len(hooks), 2)
            self.assertEqual({h["id"] for h in hooks}, {"existing", "hook1"})

    def test_has_binding_after_enable(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            adapter = _adapter("claude", home=home)

            self.assertFalse(adapter.has_binding("hook1"))
            adapter.enable_hook(_spec("hook1"))
            self.assertTrue(adapter.has_binding("hook1"))

    def test_invalid_json_raises_mutation_error(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            adapter = _adapter("claude", home=home)
            adapter.config_path.parent.mkdir(parents=True, exist_ok=True)
            adapter.config_path.write_text("{not json", encoding="utf-8")

            with self.assertRaises(MutationError):
                adapter.enable_hook(_spec("hook1"))

    def test_scan_reports_malformed_config_without_raising(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = HookStore(home / "manifest.json")
            store.upsert_managed(_spec("hook1"))
            adapter = _adapter("claude", home=home)
            adapter.config_path.parent.mkdir(parents=True, exist_ok=True)
            adapter.config_path.write_text("{not json", encoding="utf-8")

            scan = adapter.scan(store.list_managed())

            self.assertIn("not valid JSON", scan.scan_issue or "")
            states = {entry.id: entry.state for entry in scan.entries}
            self.assertEqual(states["hook1"], "missing")


if __name__ == "__main__":
    unittest.main()
