from __future__ import annotations

from fastapi import APIRouter, Depends

from skill_manager.api.deps import get_container
from skill_manager.api.schemas import (
    AddHookRequest,
    DisableHookRequest,
    EnableHookRequest,
    HookApplyConfigResponse,
    HookInventoryEntryResponse,
    HookInventoryResponse,
    HookMutationResponse,
    HookSetHarnessesResultResponse,
    OkResponse,
    ReconcileHookRequest,
    SetHookHarnessesRequest,
)
from skill_manager.application import BackendContainer
from skill_manager.application.hooks.store import HookSpec

router = APIRouter(prefix="/api/hooks")


@router.get("", response_model=HookInventoryResponse)
def list_hooks(container: BackendContainer = Depends(get_container)) -> dict[str, object]:
    return container.hooks_queries.list_hooks()


@router.get("/{id}", response_model=HookInventoryEntryResponse)
def get_hook(
    id: str,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.hooks_queries.get_hook(id)


@router.post("", response_model=HookMutationResponse)
def create_hook(
    body: AddHookRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    spec = HookSpec(
        id=body.id,
        event=body.event,
        command=body.command,
        match=body.match,
        timeout=body.timeout,
        description=body.description,
    )
    stored = container.hooks_mutations.create_hook(spec)
    return {"ok": True, "hook": stored.to_dict()}


@router.delete("/{id}", response_model=HookSetHarnessesResultResponse)
def delete_hook(
    id: str,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.hooks_mutations.delete_hook(id)


@router.post("/{id}/enable", response_model=OkResponse)
def enable_hook(
    id: str,
    body: EnableHookRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, bool]:
    return container.hooks_mutations.enable_hook(id, body.harness)


@router.post("/{id}/disable", response_model=OkResponse)
def disable_hook(
    id: str,
    body: DisableHookRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, bool]:
    return container.hooks_mutations.disable_hook(id, body.harness)


@router.post("/{id}/reconcile", response_model=HookApplyConfigResponse)
def reconcile_hook(
    id: str,
    body: ReconcileHookRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.hooks_mutations.reconcile_hook(
        id,
        source_kind=body.source_kind,
        observed_harness=body.observed_harness,
        harnesses=body.harnesses,
    )


@router.post("/{id}/set-harnesses", response_model=HookSetHarnessesResultResponse)
def set_hook_harnesses(
    id: str,
    body: SetHookHarnessesRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.hooks_mutations.set_hook_all_harnesses(id, body.target)
