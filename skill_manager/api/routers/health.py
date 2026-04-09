from __future__ import annotations

from fastapi import APIRouter, Depends

from skill_manager.application import BackendContainer
from skill_manager.api.deps import get_container

router = APIRouter(prefix="/api")


@router.get("/health")
def health(container: BackendContainer = Depends(get_container)) -> dict[str, object]:
    return container.skills_queries.health()
