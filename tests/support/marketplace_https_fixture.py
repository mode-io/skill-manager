from __future__ import annotations

from contextlib import AbstractContextManager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import signal
import ssl
import subprocess
from tempfile import TemporaryDirectory
from threading import Thread
from types import FrameType
from urllib.parse import parse_qs, urlparse

from tests.support.marketplace_payloads import fixture_detail_html, fixture_homepage_html, fixture_search_payload


class MarketplaceFixtureServer(AbstractContextManager["MarketplaceFixtureServer"]):
    def __init__(self) -> None:
        self._tempdir = TemporaryDirectory(prefix="skill-manager-marketplace-fixture-")
        self._root = Path(self._tempdir.name)
        self._httpd = _build_server(self._root)
        self._thread = Thread(target=self._httpd.serve_forever, daemon=True)
        self._started = False

    @property
    def base_url(self) -> str:
        port = int(self._httpd.server_address[1])
        return f"https://127.0.0.1:{port}"

    @property
    def ca_cert_path(self) -> Path:
        return self._root / "ca.pem"

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
        self._tempdir.cleanup()


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


def _build_server(root: Path) -> ThreadingHTTPServer:
    cert_path, key_path = _generate_tls_chain(root)

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


def _generate_tls_chain(root: Path) -> tuple[Path, Path]:
    ca_key = root / "ca.key"
    ca_config = root / "ca.cnf"
    ca_cert = root / "ca.pem"
    server_key = root / "server.key"
    server_csr = root / "server.csr"
    server_cert = root / "server.pem"
    server_ext = root / "server.ext"

    ca_config.write_text(
        "\n".join(
            [
                "[req]",
                "prompt = no",
                "distinguished_name = req_distinguished_name",
                "x509_extensions = v3_ca",
                "",
                "[req_distinguished_name]",
                "CN = skill-manager-test-ca",
                "",
                "[v3_ca]",
                "subjectKeyIdentifier = hash",
                "authorityKeyIdentifier = keyid:always,issuer",
                "basicConstraints = critical, CA:true",
                "keyUsage = critical, keyCertSign, cRLSign",
                "",
            ]
        ),
        encoding="utf-8",
    )

    server_ext.write_text(
        "\n".join(
            [
                "authorityKeyIdentifier=keyid,issuer",
                "basicConstraints=CA:FALSE",
                "keyUsage = digitalSignature, keyEncipherment",
                "extendedKeyUsage = serverAuth",
                "subjectAltName = @alt_names",
                "",
                "[alt_names]",
                "DNS.1 = localhost",
                "IP.1 = 127.0.0.1",
                "",
            ]
        ),
        encoding="utf-8",
    )

    _run_openssl(["genrsa", "-out", str(ca_key), "2048"])
    _run_openssl([
        "req",
        "-x509",
        "-new",
        "-nodes",
        "-key",
        str(ca_key),
        "-sha256",
        "-days",
        "3650",
        "-config",
        str(ca_config),
        "-extensions",
        "v3_ca",
        "-out",
        str(ca_cert),
    ])
    _run_openssl(["genrsa", "-out", str(server_key), "2048"])
    _run_openssl([
        "req",
        "-new",
        "-key",
        str(server_key),
        "-subj",
        "/CN=localhost",
        "-out",
        str(server_csr),
    ])
    _run_openssl([
        "x509",
        "-req",
        "-in",
        str(server_csr),
        "-CA",
        str(ca_cert),
        "-CAkey",
        str(ca_key),
        "-CAcreateserial",
        "-out",
        str(server_cert),
        "-days",
        "365",
        "-sha256",
        "-extfile",
        str(server_ext),
    ])
    return server_cert, server_key


def _run_openssl(args: list[str]) -> None:
    subprocess.run(["openssl", *args], capture_output=True, check=True, text=True)


def _parse_detail_path(path: str) -> tuple[str | None, str | None]:
    segments = [segment for segment in path.strip("/").split("/") if segment]
    if len(segments) < 3:
        return None, None
    repo = "/".join(segments[:-1])
    return repo, segments[-1]
