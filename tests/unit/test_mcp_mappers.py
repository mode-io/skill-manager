from __future__ import annotations

import unittest

from skill_manager.application.mcp import (
    ClaudeCodeMapper,
    CodexMapper,
    CursorMapper,
    OpenClawMapper,
    OpenCodeMapper,
)
from skill_manager.application.mcp.store import McpServerSpec, McpSource


def _stdio() -> McpServerSpec:
    return McpServerSpec(
        name="exa",
        display_name="Exa",
        source=McpSource.marketplace("@exa/exa-mcp"),
        transport="stdio",
        command="npx",
        args=("-y", "exa-mcp-server"),
        env=(("EXA_API_KEY", "secret"),),
    )


def _http() -> McpServerSpec:
    return McpServerSpec(
        name="remote",
        display_name="Remote",
        source=McpSource.marketplace("@remote/server"),
        transport="http",
        url="https://mcp.example.com",
        headers=(("Authorization", "Bearer x"),),
    )


class ClaudeCodeMapperTests(unittest.TestCase):
    def test_stdio_round_trip_emits_type(self) -> None:
        mapper = ClaudeCodeMapper()
        spec = _stdio()
        d = mapper.spec_to_dict(spec)
        self.assertEqual(d["type"], "stdio")
        self.assertEqual(d["command"], "npx")
        self.assertEqual(d["args"], ["-y", "exa-mcp-server"])
        self.assertEqual(d["env"], {"EXA_API_KEY": "secret"})
        round_trip = mapper.dict_to_spec("exa", d)
        self.assertEqual(round_trip.transport, "stdio")
        self.assertEqual(round_trip.command, "npx")
        self.assertEqual(round_trip.args, ("-y", "exa-mcp-server"))
        self.assertEqual(dict(round_trip.env or ()), {"EXA_API_KEY": "secret"})

    def test_http_round_trip_emits_type(self) -> None:
        mapper = ClaudeCodeMapper()
        d = mapper.spec_to_dict(_http())
        self.assertEqual(d["type"], "http")
        self.assertEqual(d["url"], "https://mcp.example.com")
        self.assertEqual(d["headers"], {"Authorization": "Bearer x"})
        round_trip = mapper.dict_to_spec("remote", d)
        self.assertEqual(round_trip.transport, "http")
        self.assertEqual(round_trip.url, "https://mcp.example.com")

    def test_accepts_legacy_url_only_entry(self) -> None:
        mapper = ClaudeCodeMapper()
        round_trip = mapper.dict_to_spec("remote", {"url": "https://mcp.example.com"})
        self.assertEqual(round_trip.transport, "http")
        self.assertEqual(round_trip.url, "https://mcp.example.com")

    def test_sse_uses_type_key(self) -> None:
        mapper = ClaudeCodeMapper()
        spec = McpServerSpec(
            name="sse",
            display_name="SSE",
            source=McpSource.manual("sse"),
            transport="sse",
            url="https://sse.example.com",
        )
        d = mapper.spec_to_dict(spec)
        self.assertEqual(d.get("type"), "sse")
        round_trip = mapper.dict_to_spec("sse", d)
        self.assertEqual(round_trip.transport, "sse")


class CursorMapperTests(unittest.TestCase):
    def test_http_round_trip_emits_type(self) -> None:
        mapper = CursorMapper()
        d = mapper.spec_to_dict(_http())
        self.assertEqual(d["type"], "http")
        self.assertEqual(d["url"], "https://mcp.example.com")
        round_trip = mapper.dict_to_spec("remote", d)
        self.assertEqual(round_trip.transport, "http")


class OpenCodeMapperTests(unittest.TestCase):
    def test_stdio_local_format(self) -> None:
        mapper = OpenCodeMapper()
        d = mapper.spec_to_dict(_stdio())
        self.assertEqual(d["type"], "local")
        self.assertEqual(d["command"], ["npx", "-y", "exa-mcp-server"])
        self.assertEqual(d["environment"], {"EXA_API_KEY": "secret"})
        self.assertTrue(d["enabled"])
        round_trip = mapper.dict_to_spec("exa", d)
        self.assertEqual(round_trip.transport, "stdio")
        self.assertEqual(round_trip.command, "npx")
        self.assertEqual(round_trip.args, ("-y", "exa-mcp-server"))

    def test_http_remote_format(self) -> None:
        mapper = OpenCodeMapper()
        d = mapper.spec_to_dict(_http())
        self.assertEqual(d["type"], "remote")
        self.assertEqual(d["url"], "https://mcp.example.com")
        self.assertEqual(d["headers"], {"Authorization": "Bearer x"})
        round_trip = mapper.dict_to_spec("remote", d)
        self.assertEqual(round_trip.transport, "http")


class CodexMapperTests(unittest.TestCase):
    def test_stdio_uses_native_cli_shape(self) -> None:
        mapper = CodexMapper()
        d = mapper.spec_to_dict(_stdio())
        self.assertNotIn("transport", d)
        self.assertNotIn("enabled", d)
        self.assertEqual(d["command"], "npx")
        self.assertEqual(d["args"], ["-y", "exa-mcp-server"])
        round_trip = mapper.dict_to_spec("exa", d)
        self.assertEqual(round_trip.transport, "stdio")
        self.assertEqual(round_trip.command, "npx")

    def test_http_uses_http_headers_key(self) -> None:
        mapper = CodexMapper()
        d = mapper.spec_to_dict(_http())
        self.assertEqual(d["url"], "https://mcp.example.com")
        self.assertEqual(d["http_headers"], {"Authorization": "Bearer x"})
        self.assertNotIn("enabled", d)
        round_trip = mapper.dict_to_spec("remote", d)
        self.assertEqual(round_trip.transport, "http")
        self.assertEqual(round_trip.url, "https://mcp.example.com")


class OpenClawMapperTests(unittest.TestCase):
    def test_http_uses_streamable_http_transport(self) -> None:
        mapper = OpenClawMapper()
        d = mapper.spec_to_dict(_http())
        self.assertEqual(d["transport"], "streamable-http")
        self.assertEqual(d["url"], "https://mcp.example.com")
        round_trip = mapper.dict_to_spec("remote", d)
        self.assertEqual(round_trip.transport, "http")


if __name__ == "__main__":
    unittest.main()
