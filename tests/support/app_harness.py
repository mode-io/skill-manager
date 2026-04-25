from __future__ import annotations

from collections.abc import Callable
from contextlib import AbstractContextManager
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from skill_manager.application import build_backend_container
from skill_manager.application.cli_marketplace import CliMarketplaceCatalog
from skill_manager.application.mcp.installers import McpInstallProvider
from skill_manager.application.skills.marketplace import MarketplaceCatalog
from skill_manager.application.skills.source_fetch import SourceFetchService
from skill_manager.runtime.server import serve_in_thread

from .fake_home import FakeHomeSpec, create_fake_home_spec, seed_mixed_fixture


class AppTestHarness(AbstractContextManager["AppTestHarness"]):
    def __init__(
        self,
        *,
        frontend_dist: Path | None = None,
        mixed: bool = False,
        seed_openclaw: bool = True,
        fixture_factory: Callable[[FakeHomeSpec], None] | None = None,
        marketplace: MarketplaceCatalog | None = None,
        cli_marketplace: CliMarketplaceCatalog | None = None,
        env_overrides: dict[str, str] | None = None,
        source_fetcher: SourceFetchService | None = None,
        mcp_install_provider: McpInstallProvider | None = None,
    ) -> None:
        self._tempdir = TemporaryDirectory(prefix="skill-manager-tests-")
        self.spec = create_fake_home_spec(Path(self._tempdir.name), seed_openclaw_state=seed_openclaw)
        if mixed and fixture_factory is not None:
            raise ValueError("pass either mixed=True or fixture_factory, not both")
        seeder = fixture_factory or (seed_mixed_fixture if mixed else None)
        if seeder is not None:
            seeder(self.spec)
        active_env = self.spec.env()
        if env_overrides:
            active_env.update(env_overrides)
        if marketplace is None:
            self.container = build_backend_container(
                active_env,
                marketplace_catalog=MarketplaceCatalog.from_environment(active_env, warm_on_init=False),
                cli_marketplace_catalog=cli_marketplace,
                source_fetcher=source_fetcher,
                mcp_install_provider=mcp_install_provider,
            )
        else:
            self.container = build_backend_container(
                active_env,
                marketplace_catalog=marketplace,
                cli_marketplace_catalog=cli_marketplace,
                source_fetcher=source_fetcher,
                mcp_install_provider=mcp_install_provider,
            )
            # Ensure tests exercising a custom catalog use the same read-model root.
            self.container.skills_read_models.invalidate()
        self.server = serve_in_thread(self.container, frontend_dist=frontend_dist)
        self.base_url = self.server.base_url

    def __exit__(self, exc_type, exc, tb) -> None:
        self.server.stop()
        self._tempdir.cleanup()

    def get_json(self, path: str, *, expected_status: int = 200) -> object:
        try:
            with urlopen(f"{self.base_url}{path}") as response:
                status = response.status
                payload = response.read().decode("utf-8")
        except HTTPError as error:
            status = error.code
            payload = error.read().decode("utf-8")
            error.close()
        if status != expected_status:
            raise AssertionError(f"expected {expected_status} for {path}, got {status}: {payload}")
        return json.loads(payload)

    def post_json(self, path: str, body: object = None, *, expected_status: int = 200) -> object:
        return self._send_json("POST", path, body, expected_status=expected_status)

    def put_json(self, path: str, body: object = None, *, expected_status: int = 200) -> object:
        return self._send_json("PUT", path, body, expected_status=expected_status)

    def patch_json(self, path: str, body: object = None, *, expected_status: int = 200) -> object:
        return self._send_json("PATCH", path, body, expected_status=expected_status)

    def delete_json(self, path: str, *, expected_status: int = 200) -> object:
        return self._send_json("DELETE", path, None, expected_status=expected_status)

    def _send_json(self, method: str, path: str, body: object = None, *, expected_status: int = 200) -> object:
        data = json.dumps(body).encode("utf-8") if body is not None else b""
        request = Request(
            f"{self.base_url}{path}",
            data=data,
            headers={"Content-Type": "application/json"},
            method=method,
        )
        try:
            with urlopen(request) as response:
                status = response.status
                payload = response.read().decode("utf-8")
        except HTTPError as error:
            status = error.code
            payload = error.read().decode("utf-8")
            error.close()
        if status != expected_status:
            raise AssertionError(f"expected {expected_status} for {method} {path}, got {status}: {payload}")
        return json.loads(payload)
