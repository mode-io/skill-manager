from __future__ import annotations

from fastapi import APIRouter, Depends

from skill_manager.api.deps import get_container
from skill_manager.api.schemas import (
    AddPermissionRequest,
    DisablePermissionRequest,
    EnablePermissionRequest,
    OkResponse,
    PermissionApplyConfigResponse,
    PermissionInventoryEntryResponse,
    PermissionInventoryResponse,
    PermissionMutationResponse,
    PermissionSetHarnessesResultResponse,
    PromotePermissionRequest,
    ReconcilePermissionRequest,
    SetPermissionHarnessesRequest,
)
from skill_manager.application import BackendContainer
from skill_manager.application.permissions.store import PermissionSpec

router = APIRouter(prefix="/api/permissions")


@router.get("", response_model=PermissionInventoryResponse)
def list_permissions(container: BackendContainer = Depends(get_container)) -> dict[str, object]:
    return container.permissions_queries.list_permissions()


@router.get("/{id}", response_model=PermissionInventoryEntryResponse)
def get_permission(
    id: str,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.permissions_queries.get_permission(id)


@router.post("", response_model=PermissionMutationResponse)
def create_permission(
    body: AddPermissionRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    spec = PermissionSpec(
        id=body.id,
        decision=body.decision,
        scope=body.scope,
        pattern=body.pattern,
        description=body.description,
    )
    stored = container.permissions_mutations.create_permission(spec)
    return {"ok": True, "permission": stored.to_dict()}


@router.post("/{id}/promote", response_model=PermissionMutationResponse)
def promote_permission(
    id: str,
    body: PromotePermissionRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.permissions_mutations.promote_permission(
        id,
        observed_harness=body.observed_harness,
    )


@router.delete("/{id}", response_model=PermissionSetHarnessesResultResponse)
def delete_permission(
    id: str,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.permissions_mutations.delete_permission(id)


@router.post("/{id}/enable", response_model=OkResponse)
def enable_permission(
    id: str,
    body: EnablePermissionRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, bool]:
    return container.permissions_mutations.enable_permission(id, body.harness)


@router.post("/{id}/disable", response_model=OkResponse)
def disable_permission(
    id: str,
    body: DisablePermissionRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, bool]:
    return container.permissions_mutations.disable_permission(id, body.harness)


@router.post("/{id}/reconcile", response_model=PermissionApplyConfigResponse)
def reconcile_permission(
    id: str,
    body: ReconcilePermissionRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.permissions_mutations.reconcile_permission(
        id,
        source_kind=body.source_kind,
        observed_harness=body.observed_harness,
        harnesses=body.harnesses,
    )


@router.post("/{id}/set-harnesses", response_model=PermissionSetHarnessesResultResponse)
def set_permission_harnesses(
    id: str,
    body: SetPermissionHarnessesRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.permissions_mutations.set_permission_all_harnesses(id, body.target)
