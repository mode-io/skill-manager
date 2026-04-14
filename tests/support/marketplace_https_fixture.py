from __future__ import annotations

from contextlib import AbstractContextManager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import signal
import ssl
from threading import Thread
from types import FrameType
from urllib.parse import parse_qs, urlparse

from tests.support.marketplace_payloads import fixture_detail_html, fixture_homepage_html, fixture_search_payload

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURE_TLS_ROOT = REPO_ROOT / "tests" / "fixtures" / "marketplace_tls"


class MarketplaceFixtureServer(AbstractContextManager["MarketplaceFixtureServer"]):
    def __init__(self) -> None:
        self._httpd = _build_server()
        self._thread = Thread(target=self._httpd.serve_forever, daemon=True)
        self._started = False

    @property
    def base_url(self) -> str:
        port = int(self._httpd.server_address[1])
        return f"https://127.0.0.1:{port}"

    @property
    def ca_cert_path(self) -> Path:
        return _fixture_tls_path("ca.pem")

    def env(self) -> dict[str, str]:
        return {
            "SKILL_MANAGER_MARKETPLACE_BASE_URL": self.base_url,
            "SSL_CERT_FILE": str(self.ca_cert_path),
        }

    def __enter__(self) -> "MarketplaceFixtureServer":
        if not self._started:
            self._thread.start()
            self._started = True
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    def close(self) -> None:
        if self._started:
            self._httpd.shutdown()
            self._httpd.server_close()
            self._thread.join(timeout=5)
            self._started = False


def serve_fixture_forever(*, manifest_path: Path) -> None:
    fixture = MarketplaceFixtureServer()
    stop = {"requested": False}

    def handle_signal(_signum: int, _frame: FrameType | None) -> None:
        stop["requested"] = True

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)
    with fixture:
        manifest_path.write_text(
            json.dumps(
                {
                    "baseUrl": fixture.base_url,
                    "caCertPath": str(fixture.ca_cert_path),
                },
                indent=2,
            ) + "\n",
            encoding="utf-8",
        )
        while not stop["requested"]:
            signal.pause()


def _build_server() -> ThreadingHTTPServer:
    cert_path = _fixture_tls_path("server.pem")
    key_path = _fixture_tls_path("server.key")

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            if parsed.path == "/":
                self._send_text(200, fixture_homepage_html())
                return
            if parsed.path == "/api/search":
                params = parse_qs(parsed.query)
                query = params.get("q", [""])[0]
                limit = int(params.get("limit", ["20"])[0] or "20")
                self._send_json(200, fixture_search_payload(query, limit=limit))
                return
            repo, skill_id = _parse_detail_path(parsed.path)
            if repo is None or skill_id is None:
                self._send_json(404, {"error": "not found"})
                return
            detail = fixture_detail_html(repo, skill_id)
            if detail is None:
                self._send_json(404, {"error": "not found"})
                return
            self._send_text(200, detail)

        def log_message(self, format: str, *args) -> None:  # noqa: A003
            return

        def _send_json(self, status: int, payload: dict[str, object]) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _send_text(self, status: int, payload: str) -> None:
            body = payload.encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=str(cert_path), keyfile=str(key_path))
    server.socket = context.wrap_socket(server.socket, server_side=True)
    return server


def _fixture_tls_path(filename: str) -> Path:
    path = FIXTURE_TLS_ROOT / filename
    if not path.is_file():
        raise FileNotFoundError(f"missing marketplace TLS fixture: {path}")
    return path


def _parse_detail_path(path: str) -> tuple[str | None, str | None]:
    segments = [segment for segment in path.strip("/").split("/") if segment]
    if len(segments) < 3:
        return None, None
    repo = "/".join(segments[:-1])
    return repo, segments[-1]
