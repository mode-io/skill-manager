from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from skill_manager.api.deps import get_container
from skill_manager.api.schemas import (
    McpInstallTargetsResponse,
    McpMarketplaceDetailResponse,
    McpMarketplacePageResponse,
)
from skill_manager.application import BackendContainer

router = APIRouter(prefix="/api/marketplace/mcp")


@router.get("/popular", response_model=McpMarketplacePageResponse)
def popular_mcp_marketplace(
    limit: int | None = Query(default=None),
    offset: int = Query(default=0),
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.mcp_marketplace_catalog.popular_page(limit=limit, offset=offset)


@router.get("/search", response_model=McpMarketplacePageResponse)
def search_mcp_marketplace(
    q: str = Query(default=""),
    limit: int | None = Query(default=None),
    offset: int = Query(default=0),
    remote: bool | None = Query(default=None),
    verified: bool | None = Query(default=None),
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    try:
        return container.mcp_marketplace_catalog.search_page(
            q,
            limit=limit,
            offset=offset,
            remote=remote,
            verified=verified,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/install-targets", response_model=McpInstallTargetsResponse)
def get_mcp_install_targets(
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.mcp_mutations.install_targets()


@router.get("/items/{qualified_name:path}", response_model=McpMarketplaceDetailResponse)
def get_mcp_marketplace_detail(
    qualified_name: str,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    payload = container.mcp_marketplace_catalog.detail(qualified_name)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"unknown MCP server: {qualified_name}")
    return payload
