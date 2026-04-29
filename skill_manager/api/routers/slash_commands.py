from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from skill_manager.application import BackendContainer
from skill_manager.api.deps import get_container
from skill_manager.api.schemas import (
    SlashCommandDeleteResponse,
    SlashCommandImportRequest,
    SlashCommandListResponse,
    SlashCommandMutationRequest,
    SlashCommandMutationResponse,
    SlashCommandResolveRequest,
    SlashCommandResponse,
    SlashCommandUpdateRequest,
    SlashSyncRequest,
)

router = APIRouter(prefix="/api/slash-commands")


@router.get("", response_model=SlashCommandListResponse)
def list_slash_commands(container: BackendContainer = Depends(get_container)) -> dict[str, object]:
    return container.slash_command_queries.list_commands()


@router.get("/{name}", response_model=SlashCommandResponse)
def get_slash_command(name: str, container: BackendContainer = Depends(get_container)) -> dict[str, object]:
    payload = container.slash_command_queries.get_command(name)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"unknown slash command: {name}")
    return payload


@router.post("", response_model=SlashCommandMutationResponse)
def create_slash_command(
    body: SlashCommandMutationRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.slash_command_mutations.create_command(
        name=body.name,
        description=body.description,
        prompt=body.prompt,
        targets=body.targets,
    )


@router.post("/review/import", response_model=SlashCommandMutationResponse)
def import_slash_command(
    body: SlashCommandImportRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.slash_command_mutations.import_unmanaged_command(
        target=body.target,
        name=body.name,
    )


@router.post("/review/resolve", response_model=SlashCommandMutationResponse)
def resolve_slash_command_review(
    body: SlashCommandResolveRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.slash_command_mutations.resolve_review_command(
        target=body.target,
        name=body.name,
        action=body.action,
    )


@router.put("/{name}", response_model=SlashCommandMutationResponse)
def update_slash_command(
    name: str,
    body: SlashCommandUpdateRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.slash_command_mutations.update_command(
        name,
        description=body.description,
        prompt=body.prompt,
        targets=body.targets,
    )


@router.post("/{name}/sync", response_model=SlashCommandMutationResponse)
def sync_slash_command(
    name: str,
    body: SlashSyncRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    sync = container.slash_command_mutations.sync_command(name, targets=body.targets)
    command = container.slash_command_queries.get_command(name)
    return {"ok": sync["ok"], "command": command, "sync": sync["sync"]}


@router.delete("/{name}", response_model=SlashCommandDeleteResponse)
def delete_slash_command(name: str, container: BackendContainer = Depends(get_container)) -> dict[str, object]:
    return container.slash_command_mutations.delete_command(name)
