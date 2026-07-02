from __future__ import annotations

import hashlib
import shlex
from typing import Iterable, Mapping, Protocol

from skill_manager.errors import MutationError
from .store import HookSpec


class RawHookEntry:
    def __init__(self, id: str, event: str, match: str | None, payload: dict[str, object]):
        self.id = id
        self.event = event
        self.match = match
        self.payload = payload


class HookMapper(Protocol):
    """Translates between HookSpec and a single harness's hook configuration shape."""

    def read_entries(self, document: dict[str, object], specs: Iterable[HookSpec] = ()) -> list[RawHookEntry]: ...

    def enable_hook(self, document: dict[str, object], spec: HookSpec) -> None: ...

    def disable_hook(self, document: dict[str, object], id: str, command: str | None = None) -> None: ...

    def spec_to_dict(self, spec: HookSpec) -> dict[str, object]: ...

    def dict_to_spec(
        self,
        event: str,
        match: str | None,
        raw: Mapping[str, object],
    ) -> HookSpec: ...

    def representable(self, spec: HookSpec) -> tuple[bool, str | None, str | None]: ...


class ClaudeCodeHooksMapper:
    """Mapper for Claude Code hooks under ~/.claude/settings.json."""

    def representable(self, spec: HookSpec) -> tuple[bool, str | None, str | None]:
        supported_events = {"pre_tool_use", "post_tool_use", "user_prompt_submit", "session_start", "stop", "pre_compact"}
        if spec.event not in supported_events:
            return False, f"Event '{spec.event}' is not supported by Claude Code", None
        if spec.event in ("pre_tool_use", "post_tool_use"):
            supported_categories = {"any", "shell", "file_read", "file_write", "mcp", "web"}
            cat = spec.match or "any"
            if cat not in supported_categories:
                return False, f"Tool category '{cat}' is not supported by Claude Code", None
        return True, None, None

    def spec_to_dict(self, spec: HookSpec) -> dict[str, object]:
        payload: dict[str, object] = {
            "type": "command",
            "command": spec.command,
            "id": spec.id,
        }
        if spec.timeout is not None:
            payload["timeout"] = spec.timeout
        return payload

    def dict_to_spec(
        self,
        event: str,
        match: str | None,
        raw: Mapping[str, object],
    ) -> HookSpec:
        command = raw.get("command")
        if not isinstance(command, str):
            raise MutationError("Hook command must be a string", status=400)
        
        timeout_raw = raw.get("timeout")
        timeout: int | None = None
        if isinstance(timeout_raw, (int, float)):
            timeout = int(timeout_raw)
        elif isinstance(timeout_raw, str) and timeout_raw.isdigit():
            timeout = int(timeout_raw)

        raw_id = raw.get("id")
        if isinstance(raw_id, str) and raw_id:
            hook_id = raw_id
        else:
            cmd_hash = hashlib.sha256(command.encode("utf-8")).hexdigest()[:16]
            hook_id = f"manual:{cmd_hash}"

        return HookSpec(
            id=hook_id,
            event=event,
            command=command,
            match=match,
            timeout=timeout,
        )

    def read_entries(self, document: dict[str, object], specs: Iterable[HookSpec] = ()) -> list[RawHookEntry]:
        hooks_subtree = document.get("hooks")
        if not isinstance(hooks_subtree, dict):
            return []
        
        event_map = {
            "PreToolUse": "pre_tool_use",
            "PostToolUse": "post_tool_use",
            "UserPromptSubmit": "user_prompt_submit",
            "SessionStart": "session_start",
            "Stop": "stop",
            "PreCompact": "pre_compact",
        }
        
        matcher_map = {
            "Bash": "shell",
            "Read": "file_read",
            "Edit|Write": "file_write",
            "Edit": "file_write",
            "Write": "file_write",
            "mcp__.*": "mcp",
            "WebFetch": "web",
            "*": "any",
        }

        entries: list[RawHookEntry] = []
        for native_event, matcher_groups in hooks_subtree.items():
            if not isinstance(matcher_groups, list):
                continue
            canonical_event = event_map.get(native_event, native_event)
            for group in matcher_groups:
                if not isinstance(group, dict):
                    continue
                native_matcher = group.get("matcher")
                canonical_match = matcher_map.get(native_matcher, native_matcher) if native_matcher is not None else None
                hooks_list = group.get("hooks", [])
                if not isinstance(hooks_list, list):
                    continue
                for hook in hooks_list:
                    if not isinstance(hook, dict):
                        continue
                    command = hook.get("command", "")
                    raw_id = hook.get("id")
                    if isinstance(raw_id, str) and raw_id:
                        hook_id = raw_id
                    else:
                        matched_id = None
                        for s in specs:
                            if s.event == canonical_event and s.match == canonical_match and s.command == command:
                                matched_id = s.id
                                break
                        if matched_id:
                            hook_id = matched_id
                        else:
                            cmd_hash = hashlib.sha256(command.encode("utf-8")).hexdigest()[:16]
                            hook_id = f"manual:{cmd_hash}"
                    entries.append(
                        RawHookEntry(
                            id=hook_id,
                            event=canonical_event,
                            match=canonical_match,
                            payload=dict(hook),
                        )
                    )
        return entries

    def enable_hook(self, document: dict[str, object], spec: HookSpec) -> None:
        if "hooks" not in document:
            document["hooks"] = {}
        hooks_subtree = document["hooks"]
        if not isinstance(hooks_subtree, dict):
            raise MutationError("The top-level 'hooks' key is not an object", status=409)

        event_map = {
            "pre_tool_use": "PreToolUse",
            "post_tool_use": "PostToolUse",
            "user_prompt_submit": "UserPromptSubmit",
            "session_start": "SessionStart",
            "stop": "Stop",
            "pre_compact": "PreCompact",
        }
        native_event = event_map.get(spec.event, spec.event)

        matcher_map = {
            "shell": "Bash",
            "file_read": "Read",
            "file_write": "Edit|Write",
            "mcp": "mcp__.*",
            "web": "WebFetch",
            "any": "*",
        }
        native_matcher = matcher_map.get(spec.match) if spec.match else None

        if native_event not in hooks_subtree:
            hooks_subtree[native_event] = []
        event_list = hooks_subtree[native_event]
        if not isinstance(event_list, list):
            raise MutationError(f"The hook event '{native_event}' is not an array", status=409)

        target_group = None
        for group in event_list:
            if not isinstance(group, dict):
                continue
            group_matcher = group.get("matcher")
            if native_matcher is None:
                if "matcher" not in group or group_matcher is None:
                    target_group = group
                    break
            else:
                if group_matcher == native_matcher:
                    target_group = group
                    break

        if target_group is None:
            target_group = {"hooks": []}
            if native_matcher is not None:
                target_group["matcher"] = native_matcher
            event_list.append(target_group)

        if "hooks" not in target_group or not isinstance(target_group["hooks"], list):
            target_group["hooks"] = []

        hook_payload = self.spec_to_dict(spec)
        hooks_list = target_group["hooks"]

        updated = False
        for idx, entry in enumerate(hooks_list):
            if isinstance(entry, dict) and entry.get("id") == spec.id:
                hooks_list[idx] = hook_payload
                updated = True
                break
        if not updated:
            hooks_list.append(hook_payload)

        # Cleanup other matcher groups or events
        for ev, ev_list in list(hooks_subtree.items()):
            if not isinstance(ev_list, list):
                continue
            for grp in list(ev_list):
                if not isinstance(grp, dict) or "hooks" not in grp or not isinstance(grp["hooks"], list):
                    continue
                if ev == native_event and grp is target_group:
                    grp["hooks"] = [h for h in grp["hooks"] if not (isinstance(h, dict) and h.get("id") == spec.id and h is not hook_payload)]
                    continue
                grp["hooks"] = [h for h in grp["hooks"] if not (isinstance(h, dict) and h.get("id") == spec.id)]
                if not grp["hooks"]:
                    ev_list.remove(grp)
            if not ev_list:
                hooks_subtree.pop(ev, None)

    def disable_hook(self, document: dict[str, object], id: str, command: str | None = None) -> None:
        hooks_subtree = document.get("hooks")
        if not isinstance(hooks_subtree, dict):
            return

        removed = False
        for ev, ev_list in list(hooks_subtree.items()):
            if not isinstance(ev_list, list):
                continue
            for grp in list(ev_list):
                if not isinstance(grp, dict) or "hooks" not in grp or not isinstance(grp["hooks"], list):
                    continue
                orig_len = len(grp["hooks"])
                
                def matches(h: object) -> bool:
                    if not isinstance(h, dict):
                        return False
                    hid = h.get("id")
                    hcmd = h.get("command")
                    if hid == id:
                        return True
                    if command and hcmd == command:
                        return True
                    if id.startswith("manual:") and isinstance(hcmd, str):
                        hcmd_hash = hashlib.sha256(hcmd.encode("utf-8")).hexdigest()[:16]
                        if f"manual:{hcmd_hash}" == id:
                            return True
                    return False

                grp["hooks"] = [h for h in grp["hooks"] if not matches(h)]
                if len(grp["hooks"]) < orig_len:
                    removed = True
                if not grp["hooks"]:
                    ev_list.remove(grp)
            if not ev_list:
                hooks_subtree.pop(ev, None)

        if not hooks_subtree:
            document.pop("hooks", None)


class CodexHooksMapper(ClaudeCodeHooksMapper):
    """Mapper for OpenAI Codex hooks under ~/.codex/config.toml."""

    def representable(self, spec: HookSpec) -> tuple[bool, str | None, str | None]:
        supported_events = {"pre_tool_use", "post_tool_use", "user_prompt_submit", "session_start", "stop", "pre_compact"}
        if spec.event not in supported_events:
            return False, f"Event '{spec.event}' is not supported by Codex", None
        if spec.event in ("pre_tool_use", "post_tool_use"):
            supported_categories = {"any", "shell", "file_read", "file_write", "mcp", "web"}
            cat = spec.match or "any"
            if cat not in supported_categories:
                return False, f"Tool category '{cat}' is not supported by Codex", None
        return True, None, None


class CursorHooksMapper:
    """Mapper for Cursor hooks under ~/.cursor/hooks.json."""

    def representable(self, spec: HookSpec) -> tuple[bool, str | None, str | None]:
        supported_events = {"pre_tool_use", "post_tool_use", "user_prompt_submit", "session_start", "stop", "pre_compact"}
        if spec.event not in supported_events:
            return False, f"Event '{spec.event}' is not supported by Cursor", None
        if spec.event in ("pre_tool_use", "post_tool_use"):
            supported_categories = {"any", "shell", "file_read", "file_write", "mcp"}
            cat = spec.match or "any"
            if cat not in supported_categories:
                return False, f"Tool category '{cat}' is not supported by Cursor", None
        return True, None, None

    def spec_to_dict(self, spec: HookSpec) -> dict[str, object]:
        return {"command": spec.command}

    def dict_to_spec(
        self,
        event: str,
        match: str | None,
        raw: Mapping[str, object],
    ) -> HookSpec:
        command = raw.get("command")
        if not isinstance(command, str):
            raise MutationError("Hook command must be a string", status=400)
        cmd_hash = hashlib.sha256(command.encode("utf-8")).hexdigest()[:16]
        return HookSpec(
            id=f"manual:{cmd_hash}",
            event=event,
            command=command,
            match=match,
        )

    def _event_mapping(self) -> dict[tuple[str, str | None], str]:
        return {
            ("pre_tool_use", "shell"): "beforeShellExecution",
            ("post_tool_use", "shell"): "afterShellExecution",
            ("pre_tool_use", "file_read"): "beforeReadFile",
            ("post_tool_use", "file_write"): "afterFileEdit",
            ("pre_tool_use", "mcp"): "beforeMCPExecution",
            ("post_tool_use", "mcp"): "afterMCPExecution",
            ("pre_tool_use", "any"): "preToolUse",
            ("post_tool_use", "any"): "postToolUse",
            ("user_prompt_submit", None): "beforeSubmitPrompt",
            ("session_start", None): "sessionStart",
            ("stop", None): "stop",
            ("pre_compact", None): "preCompact",
        }

    def read_entries(self, document: dict[str, object], specs: Iterable[HookSpec] = ()) -> list[RawHookEntry]:
        hooks_subtree = document.get("hooks")
        if not isinstance(hooks_subtree, dict):
            return []

        rev_map: dict[str, tuple[str, str | None]] = {}
        for (ev, cat), native in self._event_mapping().items():
            rev_map[native] = (ev, cat)

        entries: list[RawHookEntry] = []
        for native_event, hook_list in hooks_subtree.items():
            if not isinstance(hook_list, list) or native_event not in rev_map:
                continue
            canonical_event, canonical_match = rev_map[native_event]
            for hook in hook_list:
                if not isinstance(hook, dict):
                    continue
                command = hook.get("command", "")
                
                hook_id = None
                for s in specs:
                    if s.event == canonical_event and s.match == canonical_match and s.command == command:
                        hook_id = s.id
                        break
                if not hook_id:
                    cmd_hash = hashlib.sha256(command.encode("utf-8")).hexdigest()[:16]
                    hook_id = f"manual:{cmd_hash}"
                
                entries.append(
                    RawHookEntry(
                        id=hook_id,
                        event=canonical_event,
                        match=canonical_match,
                        payload=dict(hook),
                    )
                )
        return entries

    def enable_hook(self, document: dict[str, object], spec: HookSpec) -> None:
        document["version"] = 1
        if "hooks" not in document:
            document["hooks"] = {}
        hooks_subtree = document["hooks"]
        if not isinstance(hooks_subtree, dict):
            raise MutationError("The 'hooks' key is not an object", status=409)

        cat = spec.match or "any" if spec.event in ("pre_tool_use", "post_tool_use") else None
        native_event = self._event_mapping().get((spec.event, cat))
        if not native_event:
            raise MutationError(f"Event ({spec.event}, {cat}) is not supportable on Cursor", status=400)

        if native_event not in hooks_subtree:
            hooks_subtree[native_event] = []
        hook_list = hooks_subtree[native_event]
        if not isinstance(hook_list, list):
            raise MutationError(f"The hook event '{native_event}' is not an array", status=409)

        hook_list = [h for h in hook_list if not (isinstance(h, dict) and h.get("command") == spec.command)]
        hook_list.append(self.spec_to_dict(spec))
        hooks_subtree[native_event] = hook_list

        for ev, ev_list in list(hooks_subtree.items()):
            if ev == native_event:
                continue
            if isinstance(ev_list, list):
                hooks_subtree[ev] = [h for h in ev_list if not (isinstance(h, dict) and h.get("command") == spec.command)]
                if not hooks_subtree[ev]:
                    hooks_subtree.pop(ev, None)

    def disable_hook(self, document: dict[str, object], id: str, command: str | None = None) -> None:
        hooks_subtree = document.get("hooks")
        if not isinstance(hooks_subtree, dict):
            return

        removed = False
        for ev, ev_list in list(hooks_subtree.items()):
            if not isinstance(ev_list, list):
                continue
            orig_len = len(ev_list)

            def matches(h: object) -> bool:
                if not isinstance(h, dict):
                    return False
                hcmd = h.get("command")
                if command and hcmd == command:
                    return True
                if isinstance(hcmd, str):
                    hcmd_hash = hashlib.sha256(hcmd.encode("utf-8")).hexdigest()[:16]
                    if f"manual:{hcmd_hash}" == id:
                        return True
                return False

            ev_list = [h for h in ev_list if not matches(h)]
            if len(ev_list) < orig_len:
                removed = True
            if ev_list:
                hooks_subtree[ev] = ev_list
            else:
                hooks_subtree.pop(ev, None)

        if not hooks_subtree:
            document.pop("hooks", None)


class OpenCodeHooksMapper:
    """Mapper for OpenCode hooks nested under experimental.hook in JSON."""

    def representable(self, spec: HookSpec) -> tuple[bool, str | None, str | None]:
        if spec.event == "stop":
            return True, None, None
        if spec.event == "post_tool_use" and spec.match == "file_write":
            return True, None, None
        return False, "Only 'stop' and 'post_tool_use' with 'file_write' match are supported on OpenCode", None

    def spec_to_dict(self, spec: HookSpec) -> dict[str, object]:
        return {"command": ["/bin/sh", "-c", spec.command]}

    def dict_to_spec(
        self,
        event: str,
        match: str | None,
        raw: Mapping[str, object],
    ) -> HookSpec:
        argv = raw.get("command")
        if not isinstance(argv, list):
            raise MutationError("OpenCode hook command must be an argv list", status=400)
        
        if len(argv) == 3 and argv[0] == "/bin/sh" and argv[1] == "-c":
            command = argv[2]
        else:
            command = " ".join(str(arg) for arg in argv)
            
        cmd_hash = hashlib.sha256(command.encode("utf-8")).hexdigest()[:16]
        return HookSpec(
            id=f"manual:{cmd_hash}",
            event=event,
            command=command,
            match=match,
        )

    def read_entries(self, document: dict[str, object], specs: Iterable[HookSpec] = ()) -> list[RawHookEntry]:
        exp = document.get("experimental")
        if not isinstance(exp, dict):
            return []
        hook_subtree = exp.get("hook")
        if not isinstance(hook_subtree, dict):
            return []

        entries: list[RawHookEntry] = []

        file_edited = hook_subtree.get("file_edited")
        if isinstance(file_edited, dict):
            for glob, hook_list in file_edited.items():
                if not isinstance(hook_list, list):
                    continue
                for hook in hook_list:
                    if not isinstance(hook, dict):
                        continue
                    argv = hook.get("command")
                    if not isinstance(argv, list):
                        continue
                    if len(argv) == 3 and argv[0] == "/bin/sh" and argv[1] == "-c":
                        command = argv[2]
                    else:
                        command = " ".join(str(arg) for arg in argv)

                    hook_id = None
                    for s in specs:
                        if s.event == "post_tool_use" and s.match == "file_write" and s.command == command:
                            hook_id = s.id
                            break
                    if not hook_id:
                        cmd_hash = hashlib.sha256(command.encode("utf-8")).hexdigest()[:16]
                        hook_id = f"manual:{cmd_hash}"

                    entries.append(
                        RawHookEntry(
                            id=hook_id,
                            event="post_tool_use",
                            match="file_write",
                            payload=dict(hook),
                        )
                    )

        session_completed = hook_subtree.get("session_completed")
        if isinstance(session_completed, list):
            for hook in session_completed:
                if not isinstance(hook, dict):
                    continue
                argv = hook.get("command")
                if not isinstance(argv, list):
                    continue
                if len(argv) == 3 and argv[0] == "/bin/sh" and argv[1] == "-c":
                    command = argv[2]
                else:
                    command = " ".join(str(arg) for arg in argv)

                hook_id = None
                for s in specs:
                    if s.event == "stop" and s.command == command:
                        hook_id = s.id
                        break
                if not hook_id:
                    cmd_hash = hashlib.sha256(command.encode("utf-8")).hexdigest()[:16]
                    hook_id = f"manual:{cmd_hash}"

                entries.append(
                    RawHookEntry(
                        id=hook_id,
                        event="stop",
                        match=None,
                        payload=dict(hook),
                    )
                )

        return entries

    def enable_hook(self, document: dict[str, object], spec: HookSpec) -> None:
        if "experimental" not in document:
            document["experimental"] = {}
        exp = document["experimental"]
        if not isinstance(exp, dict):
            raise MutationError("The 'experimental' key is not an object", status=409)

        if "hook" not in exp:
            exp["hook"] = {}
        hook_subtree = exp["hook"]
        if not isinstance(hook_subtree, dict):
            raise MutationError("The 'experimental.hook' key is not an object", status=409)

        hook_payload = self.spec_to_dict(spec)

        if spec.event == "stop":
            if "session_completed" not in hook_subtree:
                hook_subtree["session_completed"] = []
            session_completed = hook_subtree["session_completed"]
            if not isinstance(session_completed, list):
                raise MutationError("The 'experimental.hook.session_completed' key is not an array", status=409)
            session_completed = [h for h in session_completed if not (isinstance(h, dict) and h.get("command") == hook_payload["command"])]
            session_completed.append(hook_payload)
            hook_subtree["session_completed"] = session_completed

            file_edited = hook_subtree.get("file_edited")
            if isinstance(file_edited, dict):
                for glob, hook_list in list(file_edited.items()):
                    if isinstance(hook_list, list):
                        file_edited[glob] = [h for h in hook_list if not (isinstance(h, dict) and h.get("command") == hook_payload["command"])]
                        if not file_edited[glob]:
                            file_edited.pop(glob, None)
                if not file_edited:
                    hook_subtree.pop("file_edited", None)

        elif spec.event == "post_tool_use" and spec.match == "file_write":
            if "file_edited" not in hook_subtree:
                hook_subtree["file_edited"] = {}
            file_edited = hook_subtree["file_edited"]
            if not isinstance(file_edited, dict):
                raise MutationError("The 'experimental.hook.file_edited' key is not an object", status=409)
            if "*" not in file_edited:
                file_edited["*"] = []
            hook_list = file_edited["*"]
            if not isinstance(hook_list, list):
                raise MutationError("The 'experimental.hook.file_edited.*' key is not an array", status=409)
            hook_list = [h for h in hook_list if not (isinstance(h, dict) and h.get("command") == hook_payload["command"])]
            hook_list.append(hook_payload)
            file_edited["*"] = hook_list

            session_completed = hook_subtree.get("session_completed")
            if isinstance(session_completed, list):
                hook_subtree["session_completed"] = [h for h in session_completed if not (isinstance(h, dict) and h.get("command") == hook_payload["command"])]
                if not hook_subtree["session_completed"]:
                    hook_subtree.pop("session_completed", None)
        else:
            raise MutationError(f"Unsupported event for OpenCode: {spec.event}", status=400)

    def disable_hook(self, document: dict[str, object], id: str, command: str | None = None) -> None:
        exp = document.get("experimental")
        if not isinstance(exp, dict):
            return
        hook_subtree = exp.get("hook")
        if not isinstance(hook_subtree, dict):
            return

        command_argv = ["/bin/sh", "-c", command] if command else None

        def matches(h: object) -> bool:
            if not isinstance(h, dict):
                return False
            argv = h.get("command")
            if not isinstance(argv, list):
                return False
            if command_argv and argv == command_argv:
                return True
            if len(argv) == 3 and argv[0] == "/bin/sh" and argv[1] == "-c":
                hcmd = argv[2]
            else:
                hcmd = " ".join(str(arg) for arg in argv)
            hcmd_hash = hashlib.sha256(hcmd.encode("utf-8")).hexdigest()[:16]
            if f"manual:{hcmd_hash}" == id:
                return True
            return False

        file_edited = hook_subtree.get("file_edited")
        if isinstance(file_edited, dict):
            for glob, hook_list in list(file_edited.items()):
                if isinstance(hook_list, list):
                    file_edited[glob] = [h for h in hook_list if not matches(h)]
                    if not file_edited[glob]:
                        file_edited.pop(glob, None)
            if not file_edited:
                hook_subtree.pop("file_edited", None)

        session_completed = hook_subtree.get("session_completed")
        if isinstance(session_completed, list):
            hook_subtree["session_completed"] = [h for h in session_completed if not matches(h)]
            if not hook_subtree["session_completed"]:
                hook_subtree.pop("session_completed", None)

        if not hook_subtree:
            exp.pop("hook", None)
        if not exp:
            document.pop("experimental", None)


class AntigravityHooksMapper:
    """Mapper for Antigravity hooks under ~/.gemini/config/hooks.json."""

    def representable(self, spec: HookSpec) -> tuple[bool, str | None, str | None]:
        supported_events = {"pre_tool_use", "post_tool_use", "stop", "user_prompt_submit"}
        if spec.event not in supported_events:
            return False, f"Event '{spec.event}' is not supported by Antigravity", None
        if spec.event in ("pre_tool_use", "post_tool_use"):
            supported_categories = {"any", "shell", "file_read", "file_write", "web"}
            cat = spec.match or "any"
            if cat not in supported_categories:
                return False, f"Tool category '{cat}' is not supported by Antigravity", None
        if spec.event == "user_prompt_submit":
            return (
                True,
                None,
                "On Antigravity this maps to PreInvocation, which fires before every model invocation, not only on user-prompt submit.",
            )
        return True, None, None

    def spec_to_dict(self, spec: HookSpec) -> dict[str, object]:
        payload: dict[str, object] = {
            "type": "command",
            "command": spec.command,
        }
        if spec.timeout is not None:
            payload["timeout"] = spec.timeout
        return payload

    def dict_to_spec(
        self,
        event: str,
        match: str | None,
        raw: Mapping[str, object],
    ) -> HookSpec:
        command = raw.get("command")
        if not isinstance(command, str):
            raise MutationError("Hook command must be a string", status=400)
        
        timeout_raw = raw.get("timeout")
        timeout: int | None = None
        if isinstance(timeout_raw, (int, float)):
            timeout = int(timeout_raw)
        elif isinstance(timeout_raw, str) and timeout_raw.isdigit():
            timeout = int(timeout_raw)

        cmd_hash = hashlib.sha256(command.encode("utf-8")).hexdigest()[:16]
        return HookSpec(
            id=f"manual:{cmd_hash}",
            event=event,
            command=command,
            match=match,
            timeout=timeout,
        )

    def read_entries(self, document: dict[str, object], specs: Iterable[HookSpec] = ()) -> list[RawHookEntry]:
        event_map = {
            "PreToolUse": "pre_tool_use",
            "PostToolUse": "post_tool_use",
            "Stop": "stop",
            "PreInvocation": "user_prompt_submit",
        }
        matcher_map = {
            "run_command": "shell",
            "view_file": "file_read",
            "write_to_file|replace_file_content|multi_replace_file_content": "file_write",
            "read_url_content|search_web": "web",
            "*": "any",
        }

        entries: list[RawHookEntry] = []
        for hook_id, hook_entry in document.items():
            if not isinstance(hook_entry, dict):
                continue
            for native_event, val in hook_entry.items():
                if native_event == "enabled":
                    continue
                canonical_event = event_map.get(native_event)
                if not canonical_event:
                    continue
                
                if native_event in ("Stop", "PreInvocation"):
                    if isinstance(val, list):
                        for hook in val:
                            if not isinstance(hook, dict):
                                continue
                            entries.append(
                                RawHookEntry(
                                    id=hook_id,
                                    event=canonical_event,
                                    match=None,
                                    payload=dict(hook),
                                )
                            )
                else:
                    if isinstance(val, list):
                        for group in val:
                            if not isinstance(group, dict):
                                continue
                            native_matcher = group.get("matcher")
                            canonical_match = matcher_map.get(native_matcher, native_matcher) if native_matcher is not None else None
                            hooks_list = group.get("hooks", [])
                            if isinstance(hooks_list, list):
                                for hook in hooks_list:
                                    if not isinstance(hook, dict):
                                        continue
                                    entries.append(
                                        RawHookEntry(
                                            id=hook_id,
                                            event=canonical_event,
                                            match=canonical_match,
                                            payload=dict(hook),
                                        )
                                    )
        return entries

    def enable_hook(self, document: dict[str, object], spec: HookSpec) -> None:
        if spec.id not in document:
            document[spec.id] = {}
        entry = document[spec.id]
        if not isinstance(entry, dict):
            raise MutationError(f"Antigravity hook entry '{spec.id}' is not an object", status=409)

        entry["enabled"] = True
        
        for k in list(entry.keys()):
            if k != "enabled":
                entry.pop(k)

        hook_payload = self.spec_to_dict(spec)

        if spec.event == "stop":
            entry["Stop"] = [hook_payload]
        elif spec.event == "user_prompt_submit":
            entry["PreInvocation"] = [hook_payload]
        elif spec.event in ("pre_tool_use", "post_tool_use"):
            native_event = "PreToolUse" if spec.event == "pre_tool_use" else "PostToolUse"
            matcher_map = {
                "shell": "run_command",
                "file_read": "view_file",
                "file_write": "write_to_file|replace_file_content|multi_replace_file_content",
                "web": "read_url_content|search_web",
                "any": "*",
            }
            native_matcher = matcher_map.get(spec.match or "any", "*")
            entry[native_event] = [
                {
                    "matcher": native_matcher,
                    "hooks": [hook_payload],
                }
            ]
        else:
            raise MutationError(f"Unsupported event for Antigravity: {spec.event}", status=400)

    def disable_hook(self, document: dict[str, object], id: str, command: str | None = None) -> None:
        if id in document:
            document.pop(id, None)
            return

        for hook_id, entry in list(document.items()):
            if not isinstance(entry, dict):
                continue
            matches = False
            for native_event, val in entry.items():
                if native_event == "enabled":
                    continue
                if native_event in ("Stop", "PreInvocation"):
                    if isinstance(val, list):
                        for hook in val:
                            if isinstance(hook, dict) and hook.get("command") == command:
                                matches = True
                            elif isinstance(hook, dict) and id.startswith("manual:"):
                                hcmd = hook.get("command")
                                if isinstance(hcmd, str):
                                    hcmd_hash = hashlib.sha256(hcmd.encode("utf-8")).hexdigest()[:16]
                                    if f"manual:{hcmd_hash}" == id:
                                        matches = True
                else:
                    if isinstance(val, list):
                        for group in val:
                            if not isinstance(group, dict):
                                continue
                            hooks_list = group.get("hooks", [])
                            if isinstance(hooks_list, list):
                                for hook in hooks_list:
                                    if isinstance(hook, dict) and hook.get("command") == command:
                                        matches = True
                                    elif isinstance(hook, dict) and id.startswith("manual:"):
                                        hcmd = hook.get("command")
                                        if isinstance(hcmd, str):
                                            hcmd_hash = hashlib.sha256(hcmd.encode("utf-8")).hexdigest()[:16]
                                            if f"manual:{hcmd_hash}" == id:
                                                matches = True
            if matches:
                document.pop(hook_id, None)


_MAPPERS: dict[str, HookMapper] = {
    "claude-code-hooks": ClaudeCodeHooksMapper(),
    "codex-hooks": CodexHooksMapper(),
    "cursor-hooks": CursorHooksMapper(),
    "opencode-hooks": OpenCodeHooksMapper(),
    "antigravity-hooks": AntigravityHooksMapper(),
}


def get_mapper(kind: str) -> HookMapper:
    if kind not in _MAPPERS:
        raise ValueError(f"unknown hooks mapper kind: {kind}")
    return _MAPPERS[kind]


__all__ = [
    "ClaudeCodeHooksMapper",
    "CodexHooksMapper",
    "CursorHooksMapper",
    "OpenCodeHooksMapper",
    "AntigravityHooksMapper",
    "HookMapper",
    "RawHookEntry",
    "get_mapper",
]
