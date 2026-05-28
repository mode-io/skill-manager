from __future__ import annotations

import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from skill_manager.application.mcp.availability import McpAvailabilityProbe
from skill_manager.application.mcp.store import McpServerSpec, McpSource


def _http_spec() -> McpServerSpec:
    return McpServerSpec(
        name="github",
        display_name="GitHub",
        source=McpSource.marketplace("github"),
        transport="http",
        url="https://server.example/github/mcp",
    )


class McpAvailabilityProbeTests(unittest.TestCase):
    def test_http_probe_marks_server_available_when_tools_list_succeeds(self) -> None:
        calls: list[str] = []

        def post(_url: str, payload: dict[str, object], _headers: dict[str, str]) -> tuple[dict[str, object], dict[str, str]]:
            method = str(payload.get("method"))
            calls.append(method)
            if method == "initialize":
                return {"jsonrpc": "2.0", "id": payload["id"], "result": {"protocolVersion": "2025-06-18"}}, {
                    "Mcp-Session-Id": "session-1"
                }
            if method == "notifications/initialized":
                return {"jsonrpc": "2.0", "result": {}}, {}
            if method == "tools/list":
                return {"jsonrpc": "2.0", "id": payload["id"], "result": {"tools": []}}, {}
            raise AssertionError(f"unexpected method {method}")

        result = McpAvailabilityProbe(http_post=post).probe(_http_spec())

        self.assertEqual(result.status, "available")
        self.assertIsNone(result.reason)
        self.assertEqual(calls, ["initialize", "notifications/initialized", "tools/list"])

    def test_http_probe_sends_configured_headers_with_each_request(self) -> None:
        seen_headers: list[dict[str, str]] = []
        spec = McpServerSpec(
            name="github",
            display_name="GitHub",
            source=McpSource.marketplace("github"),
            transport="http",
            url="https://server.example/github/mcp",
            headers=(("Authorization", "Bearer test-token"),),
        )

        def post(_url: str, payload: dict[str, object], headers: dict[str, str]) -> tuple[dict[str, object], dict[str, str]]:
            seen_headers.append(dict(headers))
            method = str(payload.get("method"))
            if method == "initialize":
                return {"jsonrpc": "2.0", "id": payload["id"], "result": {"protocolVersion": "2025-06-18"}}, {
                    "Mcp-Session-Id": "session-1"
                }
            if method == "notifications/initialized":
                return {"jsonrpc": "2.0", "result": {}}, {}
            if method == "tools/list":
                return {"jsonrpc": "2.0", "id": payload["id"], "result": {"tools": []}}, {}
            raise AssertionError(f"unexpected method {method}")

        result = McpAvailabilityProbe(http_post=post).probe(spec)

        self.assertEqual(result.status, "available")
        self.assertEqual([headers["Authorization"] for headers in seen_headers], [
            "Bearer test-token",
            "Bearer test-token",
            "Bearer test-token",
        ])
        self.assertNotIn("Mcp-Session-Id", seen_headers[0])
        self.assertEqual(seen_headers[1]["Mcp-Session-Id"], "session-1")
        self.assertEqual(seen_headers[2]["Mcp-Session-Id"], "session-1")

    def test_http_probe_marks_server_unavailable_when_auth_fails(self) -> None:
        def post(_url: str, _payload: dict[str, object], _headers: dict[str, str]) -> tuple[dict[str, object], dict[str, str]]:
            raise HTTPError(_url, 401, "Unauthorized", {}, None)

        result = McpAvailabilityProbe(http_post=post).probe(_http_spec())

        self.assertEqual(result.status, "unavailable")
        self.assertIn("401", result.reason or "")

    def test_http_probe_retries_transient_failures_before_returning_unavailable(self) -> None:
        attempts = 0

        def post(_url: str, payload: dict[str, object], _headers: dict[str, str]) -> tuple[dict[str, object], dict[str, str]]:
            nonlocal attempts
            if payload.get("method") == "initialize":
                attempts += 1
                if attempts == 1:
                    raise URLError("connection refused")
                return {"jsonrpc": "2.0", "id": payload["id"], "result": {"protocolVersion": "2025-06-18"}}, {}
            if payload.get("method") == "notifications/initialized":
                return {"jsonrpc": "2.0", "result": {}}, {}
            if payload.get("method") == "tools/list":
                return {"jsonrpc": "2.0", "id": payload["id"], "result": {"tools": []}}, {}
            raise AssertionError(f"unexpected method {payload.get('method')}")

        result = McpAvailabilityProbe(http_post=post, retry_delay_seconds=0).probe(_http_spec())

        self.assertEqual(result.status, "available")
        self.assertEqual(attempts, 2)

    def test_default_http_post_returns_first_sse_data_event_without_reading_to_eof(self) -> None:
        class SseResponse:
            headers = {"Content-Type": "text/event-stream"}

            def __init__(self) -> None:
                self.read_called = False
                self._lines = iter(
                    [
                        b"event: message\n",
                        b'data: {"jsonrpc":"2.0","id":1,"result":{"tools":[]}}\n',
                        b"\n",
                    ]
                )

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return None

            def read(self) -> bytes:
                self.read_called = True
                raise AssertionError("SSE responses should not be read to EOF")

            def readline(self) -> bytes:
                return next(self._lines, b"")

        response = SseResponse()

        with patch("skill_manager.application.mcp.availability.urlopen", return_value=response):
            payload, headers = McpAvailabilityProbe()._default_http_post(
                "https://server.example/sse",
                {"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
                {},
            )

        self.assertFalse(response.read_called)
        self.assertEqual(payload["result"], {"tools": []})
        self.assertEqual(headers["Content-Type"], "text/event-stream")


if __name__ == "__main__":
    unittest.main()
