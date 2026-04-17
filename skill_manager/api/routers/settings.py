from __future__ import annotations

from fastapi import APIRouter, Depends

from skill_manager.application import BackendContainer
from skill_manager.api.deps import get_container
from skill_manager.api.schemas import SetHarnessSupportRequest

router = APIRouter(prefix="/api/settings")


@router.get("")
def settings(container: BackendContainer = Depends(get_container)) -> dict[str, object]:
    return container.settings_queries.get_settings()


@router.put("/harnesses/{harness}/support")
def set_harness_support(
    harness: str,
    body: SetHarnessSupportRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.settings_mutations.set_harness_support(harness, body.enabled)
