from __future__ import annotations

from fastapi import APIRouter, Depends

from skill_manager.api.deps import get_container
from skill_manager.api.schemas import (
    AddMcpServerRequest,
    AdoptMcpRequest,
    DisableMcpServerRequest,
    EnableMcpServerRequest,
    McpApplyConfigResponse,
    McpInventoryResponse,
    McpServerDetailResponse,
    McpServerMutationResponse,
    McpSetHarnessesResultResponse,
    McpUnmanagedByServerResponse,
    OkResponse,
    ReconcileMcpServerRequest,
    SetMcpServerHarnessesRequest,
)
from skill_manager.application import BackendContainer

router = APIRouter(prefix="/api/mcp")


@router.get("/servers", response_model=McpInventoryResponse)
def list_mcp_servers(container: BackendContainer = Depends(get_container)) -> dict[str, object]:
    return container.mcp_queries.list_servers()


@router.get("/servers/{name}", response_model=McpServerDetailResponse)
def get_mcp_server(
    name: str,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.mcp_queries.get_server(name)


@router.post("/servers", response_model=McpServerMutationResponse)
def install_mcp_server(
    body: AddMcpServerRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.mcp_mutations.install_from_marketplace(
        body.qualified_name,
        source_harness=body.source_harness,
    )


@router.delete("/servers/{name}", response_model=McpSetHarnessesResultResponse)
def uninstall_mcp_server(
    name: str,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.mcp_mutations.uninstall_server(name)


@router.post("/servers/{name}/enable", response_model=OkResponse)
def enable_mcp_server(
    name: str,
    body: EnableMcpServerRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, bool]:
    return container.mcp_mutations.enable_server(name, body.harness)


@router.post("/servers/{name}/disable", response_model=OkResponse)
def disable_mcp_server(
    name: str,
    body: DisableMcpServerRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, bool]:
    return container.mcp_mutations.disable_server(name, body.harness)


@router.post("/servers/{name}/reconcile", response_model=McpApplyConfigResponse)
def reconcile_mcp_server(
    name: str,
    body: ReconcileMcpServerRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.mcp_mutations.reconcile_server(
        name,
        source_kind=body.source_kind,
        source_harness=body.source_harness,
        harnesses=body.harnesses,
    )


@router.post("/servers/{name}/set-harnesses", response_model=McpSetHarnessesResultResponse)
def set_mcp_server_harnesses(
    name: str,
    body: SetMcpServerHarnessesRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.mcp_mutations.set_server_all_harnesses(name, body.target)


@router.get("/unmanaged/by-server", response_model=McpUnmanagedByServerResponse)
def list_unmanaged_by_server(
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.mcp_queries.list_unmanaged_by_server()


@router.post("/unmanaged/adopt", response_model=McpApplyConfigResponse)
def adopt_mcp_server(
    body: AdoptMcpRequest,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.mcp_mutations.adopt(
        body.name,
        source_harness=body.source_harness,
        harnesses=body.harnesses,
    )
