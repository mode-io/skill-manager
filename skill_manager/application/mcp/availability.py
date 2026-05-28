from __future__ import annotations

import json
import os
import queue
import subprocess
import threading
import time
from dataclasses import dataclass
from typing import Callable, Literal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .store import McpServerSpec


AvailabilityStatus = Literal["available", "unavailable"]
HttpPost = Callable[[str, dict[str, object], dict[str, str]], tuple[dict[str, object], dict[str, str]]]


@dataclass(frozen=True)
class McpAvailabilityResult:
    status: AvailabilityStatus
    reason: str | None = None


AvailabilityCache = dict[tuple[str, str], McpAvailabilityResult]


def availability_cache_key(name: str, spec: McpServerSpec) -> tuple[str, str]:
    return (name, spec.revision)


class McpAvailabilityProbe:
    def __init__(
        self,
        *,
        timeout_seconds: float = 3.0,
        retry_attempts: int = 2,
        retry_delay_seconds: float = 0.25,
        http_post: HttpPost | None = None,
    ) -> None:
        self.timeout_seconds = timeout_seconds
        self.retry_attempts = max(1, retry_attempts)
        self.retry_delay_seconds = max(0.0, retry_delay_seconds)
        self._http_post = http_post or self._default_http_post

    def probe(self, spec: McpServerSpec) -> McpAvailabilityResult:
        result = McpAvailabilityResult("unavailable")
        for attempt in range(self.retry_attempts):
            result = self._probe_once(spec)
            if result.status == "available" or not _is_retryable_reason(result.reason):
                return result
            if attempt < self.retry_attempts - 1 and self.retry_delay_seconds > 0:
                time.sleep(self.retry_delay_seconds)
        return result

    def _probe_once(self, spec: McpServerSpec) -> McpAvailabilityResult:
        if spec.transport in {"http", "sse"}:
            return self._probe_http(spec)
        if spec.transport == "stdio":
            return self._probe_stdio(spec)
        return McpAvailabilityResult("unavailable", f"unsupported MCP transport: {spec.transport}")

    def _probe_http(self, spec: McpServerSpec) -> McpAvailabilityResult:
        if not spec.url:
            return McpAvailabilityResult("unavailable", "missing MCP URL")
        headers = _base_mcp_headers()
        headers.update(spec.headers_dict())
        try:
            initialize, response_headers = self._http_post(
                spec.url,
                _initialize_request(1),
                headers,
            )
            error = _json_rpc_error(initialize)
            if error:
                return McpAvailabilityResult("unavailable", error)

            session_id = _header_value(response_headers, "mcp-session-id")
            if session_id:
                headers["Mcp-Session-Id"] = session_id

            self._http_post(spec.url, _initialized_notification(), headers)
            tools, _ = self._http_post(spec.url, _tools_list_request(2), headers)
        except HTTPError as error:
            return McpAvailabilityResult("unavailable", f"HTTP {error.code} {error.reason}")
        except (OSError, TimeoutError, URLError, ValueError) as error:
            return McpAvailabilityResult("unavailable", str(error) or error.__class__.__name__)

        error = _json_rpc_error(tools)
        if error:
            return McpAvailabilityResult("unavailable", error)
        if isinstance(tools.get("result"), dict):
            return McpAvailabilityResult("available")
        return McpAvailabilityResult("unavailable", "MCP tools/list did not return a result")

    def _probe_stdio(self, spec: McpServerSpec) -> McpAvailabilityResult:
        if not spec.command:
            return McpAvailabilityResult("unavailable", "missing MCP command")
        argv = [spec.command, *(spec.args or ())]
        env = os.environ.copy()
        if spec.env:
            env.update(dict(spec.env))
        try:
            process = subprocess.Popen(
                argv,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env,
            )
        except OSError as error:
            return McpAvailabilityResult("unavailable", str(error) or error.__class__.__name__)

        assert process.stdin is not None
        assert process.stdout is not None
        lines: queue.Queue[str] = queue.Queue()
        reader = threading.Thread(target=_read_stdout_lines, args=(process.stdout, lines), daemon=True)
        reader.start()
        try:
            for payload in (
                _initialize_request(1),
                _initialized_notification(),
                _tools_list_request(2),
            ):
                process.stdin.write(json.dumps(payload) + "\n")
                process.stdin.flush()
            result = _wait_for_json_rpc_result(lines, request_id=2, timeout_seconds=self.timeout_seconds)
        except (OSError, TimeoutError, ValueError) as error:
            return McpAvailabilityResult("unavailable", str(error) or error.__class__.__name__)
        finally:
            _terminate_process(process)

        error = _json_rpc_error(result)
        if error:
            return McpAvailabilityResult("unavailable", error)
        if isinstance(result.get("result"), dict):
            return McpAvailabilityResult("available")
        return McpAvailabilityResult("unavailable", "MCP tools/list did not return a result")

    def _default_http_post(
        self,
        url: str,
        payload: dict[str, object],
        headers: dict[str, str],
    ) -> tuple[dict[str, object], dict[str, str]]:
        request = Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urlopen(request, timeout=self.timeout_seconds) as response:
            response_headers = dict(response.headers.items())
            content_type = _header_value(response_headers, "content-type") or ""
            if "text/event-stream" in content_type.lower():
                response_payload = _read_sse_response(response)
            else:
                body = response.read().decode("utf-8")
                response_payload = _parse_mcp_response(body)
            return response_payload, response_headers


def _base_mcp_headers() -> dict[str, str]:
    return {
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
    }


def _initialize_request(request_id: int) -> dict[str, object]:
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "skill-manager", "version": "0.3.1"},
        },
    }


def _initialized_notification() -> dict[str, object]:
    return {"jsonrpc": "2.0", "method": "notifications/initialized"}


def _tools_list_request(request_id: int) -> dict[str, object]:
    return {"jsonrpc": "2.0", "id": request_id, "method": "tools/list", "params": {}}


def _parse_mcp_response(body: str) -> dict[str, object]:
    stripped = body.strip()
    if not stripped:
        return {}
    if stripped.startswith("event:") or stripped.startswith("data:"):
        data_lines = [
            line.removeprefix("data:").strip()
            for line in stripped.splitlines()
            if line.startswith("data:")
        ]
        for line in data_lines:
            if not line or line == "[DONE]":
                continue
            payload = json.loads(line)
            if isinstance(payload, dict):
                return payload
        return {}
    payload = json.loads(stripped)
    if not isinstance(payload, dict):
        raise ValueError("MCP response was not a JSON object")
    return payload


def _read_sse_response(stream) -> dict[str, object]:
    data_lines: list[str] = []
    while True:
        raw_line = stream.readline()
        if not raw_line:
            break
        line = raw_line.decode("utf-8").rstrip("\r\n")
        if not line:
            payload = _parse_sse_data_lines(data_lines)
            if payload is not None:
                return payload
            data_lines = []
            continue
        if line.startswith("data:"):
            data_lines.append(line.removeprefix("data:").strip())

    payload = _parse_sse_data_lines(data_lines)
    return payload if payload is not None else {}


def _parse_sse_data_lines(data_lines: list[str]) -> dict[str, object] | None:
    data = "\n".join(line for line in data_lines if line and line != "[DONE]").strip()
    if not data:
        return None
    payload = json.loads(data)
    if isinstance(payload, dict):
        return payload
    raise ValueError("MCP SSE data was not a JSON object")


def _header_value(headers: dict[str, str], name: str) -> str | None:
    for key, value in headers.items():
        if key.lower() == name.lower():
            return value
    return None


def _json_rpc_error(payload: dict[str, object]) -> str | None:
    error = payload.get("error")
    if isinstance(error, dict):
        message = error.get("message")
        code = error.get("code")
        if message is not None and code is not None:
            return f"{code}: {message}"
        if message is not None:
            return str(message)
    return None


def _is_retryable_reason(reason: str | None) -> bool:
    if reason is None:
        return True
    lower = reason.lower()
    if lower.startswith("http 4"):
        return False
    if "missing mcp" in lower or "unsupported mcp" in lower:
        return False
    return True


def _read_stdout_lines(stream, lines: queue.Queue[str]) -> None:
    for line in stream:
        lines.put(line)


def _wait_for_json_rpc_result(
    lines: queue.Queue[str],
    *,
    request_id: int,
    timeout_seconds: float,
) -> dict[str, object]:
    deadline = threading.Event()
    timer = threading.Timer(timeout_seconds, deadline.set)
    timer.start()
    try:
        while not deadline.is_set():
            try:
                line = lines.get(timeout=0.05)
            except queue.Empty:
                continue
            payload = json.loads(line)
            if isinstance(payload, dict) and payload.get("id") == request_id:
                return payload
    finally:
        timer.cancel()
    raise TimeoutError("MCP probe timed out")


def _terminate_process(process: subprocess.Popen[str]) -> None:
    if process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=1.0)
    except subprocess.TimeoutExpired:
        process.kill()


__all__ = ["AvailabilityStatus", "McpAvailabilityProbe", "McpAvailabilityResult"]
