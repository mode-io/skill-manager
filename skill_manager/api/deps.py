from __future__ import annotations

from pathlib import Path

from fastapi import Request

from skill_manager.application import BackendContainer


def get_container(request: Request) -> BackendContainer:
    return request.app.state.container  # type: ignore[no-any-return]


def get_frontend_dist(request: Request) -> Path | None:
    return request.app.state.frontend_dist  # type: ignore[no-any-return]
