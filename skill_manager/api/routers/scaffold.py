from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from skill_manager.api.deps import get_container
from skill_manager.application import BackendContainer
from skill_manager.application.scaffold import ScaffoldRequest

router = APIRouter(prefix="/api/scaffold", tags=["Scaffold"])


class ScaffoldResponse(BaseModel):
    file_path: str


@router.post("", response_model=ScaffoldResponse)
def scaffold_asset(
    body: ScaffoldRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, str]:
    try:
        out_file = container.scaffold_service.scaffold_asset(body)
        # Immediately trigger a re-scan of the new asset by invalidating read models
        container.invalidation.invalidate_all()
        return {"file_path": str(out_file)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
