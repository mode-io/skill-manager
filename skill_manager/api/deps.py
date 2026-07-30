from __future__ import annotations

from fastapi import Request

from skill_manager.application import BackendContainer


def get_container(request: Request) -> BackendContainer:
    return request.app.state.container  # type: ignore[no-any-return]
