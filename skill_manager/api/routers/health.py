from __future__ import annotations

from fastapi import APIRouter, Depends

from skill_manager.api.deps import get_container
from skill_manager.application import BackendContainer

router = APIRouter(prefix="/api")


@router.get("/health")
def health(container: BackendContainer = Depends(get_container)) -> dict[str, object]:
    payload = container.skills_queries.health()
    # Home dir lets the frontend abbreviate displayed paths to ``~/…`` uniformly.
    payload["homeDir"] = str(container.harness_kernel.context.home)
    return payload
