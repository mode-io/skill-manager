from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException

from skill_manager.application import BackendContainer
from skill_manager.api.deps import get_container

router = APIRouter(prefix="/api/settings")


@router.get("")
def settings(container: BackendContainer = Depends(get_container)) -> dict[str, object]:
    return container.settings_queries.get_settings()


@router.put("/harnesses/{harness}/support")
def set_harness_support(
    harness: str,
    body: dict[str, object] | None = Body(default=None),
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    enabled = body.get("enabled") if isinstance(body, dict) else None
    if not isinstance(enabled, bool):
        raise HTTPException(status_code=400, detail="missing boolean 'enabled' in request body")
    return container.settings_mutations.set_harness_support(harness, enabled)
