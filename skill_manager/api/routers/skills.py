from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from skill_manager.application import BackendContainer
from skill_manager.api.deps import get_container
from skill_manager.api.schemas import (
    BulkManageResultResponse,
    DisableSkillRequest,
    EnableSkillRequest,
    OkResponse,
    SetSkillHarnessesRequest,
    SetSkillHarnessesResultResponse,
    SkillDetailResponse,
    SkillsPageResponse,
    SkillSourceStatusResponse,
)

router = APIRouter(prefix="/api/skills")


@router.get("", response_model=SkillsPageResponse)
def list_skills(container: BackendContainer = Depends(get_container)) -> dict[str, object]:
    return container.skills_queries.list_skills()


@router.get("/{skill_ref:path}/source-status", response_model=SkillSourceStatusResponse)
def get_skill_source_status(skill_ref: str, container: BackendContainer = Depends(get_container)) -> dict[str, object]:
    payload = container.skills_queries.get_skill_source_status(skill_ref)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"unknown skill ref: {skill_ref}")
    return payload


@router.get("/{skill_ref:path}", response_model=SkillDetailResponse)
def get_skill_detail(skill_ref: str, container: BackendContainer = Depends(get_container)) -> dict[str, object]:
    payload = container.skills_queries.get_skill_detail(skill_ref)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"unknown skill ref: {skill_ref}")
    return payload


@router.post("/{skill_ref:path}/enable", response_model=OkResponse)
def enable_skill(
    skill_ref: str,
    body: EnableSkillRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, bool]:
    return container.skills_mutations.enable_skill(skill_ref, body.harness)


@router.post("/{skill_ref:path}/disable", response_model=OkResponse)
def disable_skill(
    skill_ref: str,
    body: DisableSkillRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, bool]:
    return container.skills_mutations.disable_skill(skill_ref, body.harness)


@router.post("/{skill_ref:path}/set-harnesses", response_model=SetSkillHarnessesResultResponse)
def set_skill_harnesses(
    skill_ref: str,
    body: SetSkillHarnessesRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.skills_mutations.set_skill_all_harnesses(skill_ref, body.target)


@router.post("/{skill_ref:path}/manage", response_model=OkResponse)
def manage_skill(skill_ref: str, container: BackendContainer = Depends(get_container)) -> dict[str, bool]:
    return container.skills_mutations.manage_skill(skill_ref)


@router.post("/manage-all", response_model=BulkManageResultResponse)
def manage_all_skills(container: BackendContainer = Depends(get_container)) -> dict[str, object]:
    return container.skills_mutations.manage_all_skills()


@router.post("/{skill_ref:path}/update", response_model=OkResponse)
def update_skill(skill_ref: str, container: BackendContainer = Depends(get_container)) -> dict[str, bool]:
    return container.skills_mutations.update_skill(skill_ref)


@router.post("/{skill_ref:path}/unmanage", response_model=OkResponse)
def unmanage_skill(skill_ref: str, container: BackendContainer = Depends(get_container)) -> dict[str, bool]:
    return container.skills_mutations.unmanage_skill(skill_ref)


@router.post("/{skill_ref:path}/delete", response_model=OkResponse)
def delete_skill(skill_ref: str, container: BackendContainer = Depends(get_container)) -> dict[str, bool]:
    return container.skills_mutations.delete_skill(skill_ref)
