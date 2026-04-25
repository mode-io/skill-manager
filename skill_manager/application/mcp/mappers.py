from __future__ import annotations

from typing import Mapping, Protocol

from skill_manager.errors import MutationError

from .store import McpServerSpec, McpSource


class TransportMapper(Protocol):
    """Translates between McpServerSpec and a single harness's per-server payload dict.

    Each harness puts MCP servers under a different sub-tree (e.g. "mcpServers", "mcp",
    "mcp_servers") with slightly different keys. Managers handle the file IO; the
    mapper handles the per-entry shape conversion.
    """

    def spec_to_dict(self, spec: McpServerSpec) -> dict[str, object]: ...

    def dict_to_spec(
        self, name: str, raw: Mapping[str, object], *, source: McpSource | None = None
    ) -> McpServerSpec: ...


# Claude Code / Cursor ------------------------------------------------------


class _TypedMcpServersMapper:
    """Shared mcpServers shape used by Claude Code and Cursor.

    Both clients require explicit ``type`` on writes. The reader intentionally
    accepts older URL-only/command-only entries so Skill Manager can adopt and
    repair configs written by older versions.
    """

    source_harness: str

    def spec_to_dict(self, spec: McpServerSpec) -> dict[str, object]:
        if spec.transport == "stdio":
            payload: dict[str, object] = {"type": "stdio"}
            if spec.command is not None:
                payload["command"] = spec.command
            if spec.args:
                payload["args"] = list(spec.args)
            if spec.env:
                payload["env"] = dict(spec.env)
            return payload

        payload = {"type": spec.transport}
        if spec.url is not None:
            payload["url"] = spec.url
        if spec.headers:
            payload["headers"] = dict(spec.headers)
        return payload

    def dict_to_spec(
        self, name: str, raw: Mapping[str, object], *, source: McpSource | None = None
    ) -> McpServerSpec:
        type_value = _str_or_none(raw.get("type")) or _str_or_none(raw.get("transport"))
        if type_value == "stdio" or "command" in raw or "args" in raw:
            return McpServerSpec(
                name=name,
                display_name=name,
                source=source or McpSource.adopted(self.source_harness, name),
                transport="stdio",
                command=_str_or_none(raw.get("command")),
                args=_str_tuple(raw.get("args")),
                env=_str_pairs(raw.get("env")),
            )
        if "url" in raw:
            transport = "sse" if type_value == "sse" else "http"
            return McpServerSpec(
                name=name,
                display_name=name,
                source=source or McpSource.adopted(self.source_harness, name),
                transport=transport,
                url=_str_or_none(raw.get("url")),
                headers=_str_pairs(raw.get("headers")),
            )
        raise MutationError(
            f"unsupported {self.source_harness} mcp entry '{name}': missing 'command' and 'url'",
            status=400,
        )


class ClaudeCodeMapper(_TypedMcpServersMapper):
    source_harness = "claude"


class CursorMapper(_TypedMcpServersMapper):
    source_harness = "cursor"


# OpenCode -----------------------------------------------------------------


class OpenCodeMapper:
    """Used by opencode. Stdio = type:local + command:[cmd, ...args]; remote = type:remote.

    Reference: https://opencode.ai/docs/config/
    """

    def spec_to_dict(self, spec: McpServerSpec) -> dict[str, object]:
        if spec.transport == "stdio":
            command_list: list[str] = []
            if spec.command is not None:
                command_list.append(spec.command)
            command_list.extend(spec.args_list())
            payload: dict[str, object] = {
                "type": "local",
                "command": command_list,
                "enabled": True,
            }
            if spec.env:
                payload["environment"] = dict(spec.env)
            return payload
        payload = {
            "type": "remote",
            "url": spec.url,
            "enabled": True,
        }
        if spec.headers:
            payload["headers"] = dict(spec.headers)
        return payload

    def dict_to_spec(
        self, name: str, raw: Mapping[str, object], *, source: McpSource | None = None
    ) -> McpServerSpec:
        type_value = _str_or_none(raw.get("type"))
        if type_value == "local":
            command_list = raw.get("command")
            command: str | None = None
            args: tuple[str, ...] | None = None
            if isinstance(command_list, list) and command_list:
                command = str(command_list[0])
                rest = [str(x) for x in command_list[1:]]
                args = tuple(rest) if rest else None
            elif isinstance(command_list, str):
                command = command_list
            return McpServerSpec(
                name=name,
                display_name=name,
                source=source or McpSource.adopted("opencode", name),
                transport="stdio",
                command=command,
                args=args,
                env=_str_pairs(raw.get("environment")),
            )
        if type_value == "remote":
            return McpServerSpec(
                name=name,
                display_name=name,
                source=source or McpSource.adopted("opencode", name),
                transport="http",
                url=_str_or_none(raw.get("url")),
                headers=_str_pairs(raw.get("headers")),
            )
        raise MutationError(
            f"unsupported opencode mcp entry '{name}': type must be 'local' or 'remote'",
            status=400,
        )


# Codex --------------------------------------------------------------------


class CodexMapper:
    """Used by codex. Flat TOML table per server.

    stdio: {command, args, env}
    http:  {url, http_headers}
    """

    def spec_to_dict(self, spec: McpServerSpec) -> dict[str, object]:
        if spec.transport == "stdio":
            payload: dict[str, object] = {}
            if spec.command is not None:
                payload["command"] = spec.command
            if spec.args:
                payload["args"] = list(spec.args)
            if spec.env:
                payload["env"] = dict(spec.env)
            return payload
        payload = {}
        if spec.url is not None:
            payload["url"] = spec.url
        if spec.headers:
            payload["http_headers"] = dict(spec.headers)
        return payload

    def dict_to_spec(
        self, name: str, raw: Mapping[str, object], *, source: McpSource | None = None
    ) -> McpServerSpec:
        if "command" in raw or "args" in raw:
            return McpServerSpec(
                name=name,
                display_name=name,
                source=source or McpSource.adopted("codex", name),
                transport="stdio",
                command=_str_or_none(raw.get("command")),
                args=_str_tuple(raw.get("args")),
                env=_str_pairs(raw.get("env")),
            )
        if "url" in raw:
            return McpServerSpec(
                name=name,
                display_name=name,
                source=source or McpSource.adopted("codex", name),
                transport="http",
                url=_str_or_none(raw.get("url")),
                headers=_str_pairs(raw.get("http_headers") or raw.get("headers")),
            )
        raise MutationError(
            f"unsupported codex mcp entry '{name}': missing 'command' and 'url'",
            status=400,
        )


# OpenClaw -----------------------------------------------------------------


class OpenClawMapper:
    """OpenClaw MCP config shape, used only when the local CLI supports it."""

    def spec_to_dict(self, spec: McpServerSpec) -> dict[str, object]:
        if spec.transport == "stdio":
            payload: dict[str, object] = {}
            if spec.command is not None:
                payload["command"] = spec.command
            if spec.args:
                payload["args"] = list(spec.args)
            if spec.env:
                payload["env"] = dict(spec.env)
            return payload

        payload = {
            "url": spec.url,
            "transport": "streamable-http" if spec.transport == "http" else "sse",
        }
        if spec.headers:
            payload["headers"] = dict(spec.headers)
        return payload

    def dict_to_spec(
        self, name: str, raw: Mapping[str, object], *, source: McpSource | None = None
    ) -> McpServerSpec:
        if "command" in raw or "args" in raw:
            return McpServerSpec(
                name=name,
                display_name=name,
                source=source or McpSource.adopted("openclaw", name),
                transport="stdio",
                command=_str_or_none(raw.get("command")),
                args=_str_tuple(raw.get("args")),
                env=_str_pairs(raw.get("env")),
            )
        if "url" in raw:
            transport_raw = _str_or_none(raw.get("transport")) or _str_or_none(raw.get("type"))
            transport = "http" if transport_raw in {None, "http", "streamable-http"} else "sse"
            return McpServerSpec(
                name=name,
                display_name=name,
                source=source or McpSource.adopted("openclaw", name),
                transport=transport,
                url=_str_or_none(raw.get("url")),
                headers=_str_pairs(raw.get("headers")),
            )
        raise MutationError(
            f"unsupported openclaw mcp entry '{name}': missing 'command' and 'url'",
            status=400,
        )


# Helpers ------------------------------------------------------------------


def _str_or_none(value: object) -> str | None:
    if isinstance(value, str) and value:
        return value
    return None


def _str_tuple(value: object) -> tuple[str, ...] | None:
    if isinstance(value, list):
        return tuple(str(v) for v in value)
    return None


def _str_pairs(value: object) -> tuple[tuple[str, str], ...] | None:
    if isinstance(value, dict) and value:
        return tuple((str(k), str(v)) for k, v in value.items())
    return None


_MAPPERS: dict[str, TransportMapper] = {
    "claude-code": ClaudeCodeMapper(),
    "cursor": CursorMapper(),
    "opencode": OpenCodeMapper(),
    "codex": CodexMapper(),
    "openclaw": OpenClawMapper(),
}


def get_mapper(kind: str) -> TransportMapper:
    if kind not in _MAPPERS:
        raise ValueError(f"unknown mapper kind: {kind}")
    return _MAPPERS[kind]


__all__ = [
    "ClaudeCodeMapper",
    "CodexMapper",
    "CursorMapper",
    "OpenClawMapper",
    "OpenCodeMapper",
    "TransportMapper",
    "get_mapper",
]
