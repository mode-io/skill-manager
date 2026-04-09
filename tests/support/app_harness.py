from __future__ import annotations

from collections.abc import Callable
from contextlib import AbstractContextManager
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from skill_manager.application import build_backend_container
from skill_manager.application.marketplace import MarketplaceCatalog
from skill_manager.api import serve_in_thread

from .command_runner import StubCommandRunner
from .fake_home import FakeHomeSpec, create_fake_home_spec, seed_mixed_fixture


class AppTestHarness(AbstractContextManager["AppTestHarness"]):
    def __init__(
        self,
        *,
        frontend_dist: Path | None = None,
        mixed: bool = False,
        fixture_factory: Callable[[FakeHomeSpec], StubCommandRunner] | None = None,
        marketplace: MarketplaceCatalog | None = None,
    ) -> None:
        self._tempdir = TemporaryDirectory(prefix="skill-manager-tests-")
        self.spec = create_fake_home_spec(Path(self._tempdir.name))
        if mixed and fixture_factory is not None:
            raise ValueError("pass either mixed=True or fixture_factory, not both")
        seeder = fixture_factory or (seed_mixed_fixture if mixed else None)
        self.runner = seeder(self.spec) if seeder is not None else StubCommandRunner()
        if marketplace is None:
            self.container = build_backend_container(self.spec.env(), command_runner=self.runner)
        else:
            self.container = build_backend_container(
                self.spec.env(),
                command_runner=self.runner,
                marketplace_catalog=marketplace,
            )
            # Ensure tests exercising a custom catalog use the same read-model root.
            self.container.read_models.invalidate()
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
        data = json.dumps(body).encode("utf-8") if body is not None else b""
        request = Request(
            f"{self.base_url}{path}",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
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
            raise AssertionError(f"expected {expected_status} for POST {path}, got {status}: {payload}")
        return json.loads(payload)
