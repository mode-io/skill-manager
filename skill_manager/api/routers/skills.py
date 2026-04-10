from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException

from skill_manager.application import BackendContainer
from skill_manager.api.deps import get_container

router = APIRouter(prefix="/api/skills")


@router.get("")
def list_skills(container: BackendContainer = Depends(get_container)) -> dict[str, object]:
    return container.skills_queries.list_skills()


@router.get("/{skill_ref:path}/source-status")
def get_skill_source_status(skill_ref: str, container: BackendContainer = Depends(get_container)) -> dict[str, object]:
    payload = container.skills_queries.get_skill_source_status(skill_ref)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"unknown skill ref: {skill_ref}")
    return payload


@router.get("/{skill_ref:path}")
def get_skill_detail(skill_ref: str, container: BackendContainer = Depends(get_container)) -> dict[str, object]:
    payload = container.skills_queries.get_skill_detail(skill_ref)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"unknown skill ref: {skill_ref}")
    return payload


@router.post("/{skill_ref:path}/enable")
def enable_skill(
    skill_ref: str,
    body: dict[str, str] | None = Body(default=None),
    container: BackendContainer = Depends(get_container),
) -> dict[str, bool]:
    harness = body.get("harness", "") if isinstance(body, dict) else ""
    if not harness:
        raise HTTPException(status_code=400, detail="missing 'harness' in request body")
    return container.skills_mutations.enable_skill(skill_ref, harness)


@router.post("/{skill_ref:path}/disable")
def disable_skill(
    skill_ref: str,
    body: dict[str, str] | None = Body(default=None),
    container: BackendContainer = Depends(get_container),
) -> dict[str, bool]:
    harness = body.get("harness", "") if isinstance(body, dict) else ""
    if not harness:
        raise HTTPException(status_code=400, detail="missing 'harness' in request body")
    return container.skills_mutations.disable_skill(skill_ref, harness)


@router.post("/{skill_ref:path}/manage")
def manage_skill(skill_ref: str, container: BackendContainer = Depends(get_container)) -> dict[str, bool]:
    return container.skills_mutations.manage_skill(skill_ref)


@router.post("/manage-all")
def manage_all_skills(container: BackendContainer = Depends(get_container)) -> dict[str, object]:
    return container.skills_mutations.manage_all_skills()


@router.post("/{skill_ref:path}/update")
def update_skill(skill_ref: str, container: BackendContainer = Depends(get_container)) -> dict[str, bool]:
    return container.skills_mutations.update_skill(skill_ref)


@router.post("/{skill_ref:path}/unmanage")
def unmanage_skill(skill_ref: str, container: BackendContainer = Depends(get_container)) -> dict[str, bool]:
    return container.skills_mutations.unmanage_skill(skill_ref)


@router.post("/{skill_ref:path}/delete")
def delete_skill(skill_ref: str, container: BackendContainer = Depends(get_container)) -> dict[str, bool]:
    return container.skills_mutations.delete_skill(skill_ref)
