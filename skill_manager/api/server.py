from __future__ import annotations

from dataclasses import dataclass
import json
import mimetypes
from pathlib import Path
from threading import Thread
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

from skill_manager.application import ApplicationService
from skill_manager.harness.link_operator import MutationError


class SkillManagerRequestHandler(BaseHTTPRequestHandler):
    service: ApplicationService
    frontend_dist: Path | None

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            return self._write_json(self.service.health())
        if parsed.path == "/skills":
            return self._write_json(self.service.list_skills())
        if parsed.path.startswith("/skills/"):
            skill_ref = unquote(parsed.path[len("/skills/"):])
            payload = self.service.get_skill_detail(skill_ref)
            if payload is None:
                return self._write_json({"error": f"unknown skill ref: {skill_ref}"}, status=404)
            return self._write_json(payload)
        if parsed.path == "/marketplace/popular":
            return self._write_json(self.service.popular_marketplace())
        if parsed.path == "/marketplace/search":
            query = parse_qs(parsed.query).get("q", [""])[0]
            return self._write_json(self.service.search_marketplace(query))
        if parsed.path == "/settings":
            return self._write_json(self.service.settings())
        return self._serve_static(parsed.path)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        body = self._read_body()
        harness = body.get("harness", "") if isinstance(body, dict) else ""

        for action, method in (("/enable", self.service.enable_skill), ("/disable", self.service.disable_skill)):
            if parsed.path.startswith("/skills/") and parsed.path.endswith(action):
                skill_ref = unquote(parsed.path[len("/skills/"):-len(action)])
                if not harness:
                    return self._write_json({"error": "missing 'harness' in request body"}, status=400)
                try:
                    result = method(skill_ref, harness)
                except MutationError as error:
                    return self._write_json({"error": str(error)}, status=error.status)
                return self._write_json(result)

        if parsed.path.startswith("/skills/") and parsed.path.endswith("/manage"):
            skill_ref = unquote(parsed.path[len("/skills/"):-len("/manage")])
            try:
                result = self.service.manage_skill(skill_ref)
            except MutationError as error:
                return self._write_json({"error": str(error)}, status=error.status)
            return self._write_json(result)

        if parsed.path == "/skills/manage-all":
            try:
                result = self.service.manage_all_skills()
            except MutationError as error:
                return self._write_json({"error": str(error)}, status=error.status)
            return self._write_json(result)

        if parsed.path == "/marketplace/install":
            source_kind = body.get("sourceKind", "") if isinstance(body, dict) else ""
            source_locator = body.get("sourceLocator", "") if isinstance(body, dict) else ""
            if not source_kind or not source_locator:
                return self._write_json({"error": "missing sourceKind or sourceLocator"}, status=400)
            try:
                result = self.service.install_skill(source_kind, source_locator)
            except MutationError as error:
                return self._write_json({"error": str(error)}, status=error.status)
            return self._write_json(result)

        if parsed.path.startswith("/skills/") and parsed.path.endswith("/update"):
            skill_ref = unquote(parsed.path[len("/skills/"):-len("/update")])
            try:
                result = self.service.update_skill(skill_ref)
            except MutationError as error:
                return self._write_json({"error": str(error)}, status=error.status)
            return self._write_json(result)

        self.send_error(404)

    def _read_body(self) -> object:
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length))

    def log_message(self, fmt: str, *args: object) -> None:
        return

    def _write_json(self, payload: object, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_static(self, raw_path: str) -> None:
        if self.frontend_dist is None:
            return self._write_html("<html><body><h1>skill-manager</h1><p>Frontend build missing.</p></body></html>")

        path = raw_path.lstrip("/") or "index.html"
        target = (self.frontend_dist / path).resolve()
        if not str(target).startswith(str(self.frontend_dist.resolve())):
            self.send_error(404)
            return
        if target.is_dir():
            target = target / "index.html"
        if not target.exists():
            target = self.frontend_dist / "index.html"
        if not target.exists():
            self.send_error(404)
            return
        mime_type, _ = mimetypes.guess_type(str(target))
        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime_type or "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _write_html(self, body: str, status: int = 200) -> None:
        encoded = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


@dataclass
class ServerHandle:
    server: ThreadingHTTPServer
    thread: Thread
    base_url: str

    def stop(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)


def create_server(
    service: ApplicationService,
    *,
    host: str = "127.0.0.1",
    port: int = 0,
    frontend_dist: Path | None = None,
) -> ThreadingHTTPServer:
    class BoundSkillManagerRequestHandler(SkillManagerRequestHandler):
        pass

    BoundSkillManagerRequestHandler.service = service
    BoundSkillManagerRequestHandler.frontend_dist = frontend_dist
    server = ThreadingHTTPServer((host, port), BoundSkillManagerRequestHandler)
    return server


def serve_in_thread(
    service: ApplicationService,
    *,
    host: str = "127.0.0.1",
    port: int = 0,
    frontend_dist: Path | None = None,
) -> ServerHandle:
    server = create_server(service, host=host, port=port, frontend_dist=frontend_dist)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    actual_host, actual_port = server.server_address[:2]
    return ServerHandle(server=server, thread=thread, base_url=f"http://{actual_host}:{actual_port}")
