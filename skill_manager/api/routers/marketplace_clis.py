from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from skill_manager.api.deps import get_container
from skill_manager.api.schemas import (
    CliMarketplaceDetailResponse,
    CliMarketplacePageResponse,
)
from skill_manager.application import BackendContainer

router = APIRouter(prefix="/api/marketplace/clis")


@router.get("/popular", response_model=CliMarketplacePageResponse)
def popular_cli_marketplace(
    limit: int | None = Query(default=None),
    offset: int = Query(default=0),
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.cli_marketplace_catalog.popular_page(limit=limit, offset=offset)


@router.get("/search", response_model=CliMarketplacePageResponse)
def search_cli_marketplace(
    q: str = Query(default=""),
    limit: int | None = Query(default=None),
    offset: int = Query(default=0),
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    try:
        return container.cli_marketplace_catalog.search_page(q, limit=limit, offset=offset)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/items/{slug:path}", response_model=CliMarketplaceDetailResponse)
def get_cli_marketplace_detail(
    slug: str,
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    payload = container.cli_marketplace_catalog.detail(slug)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"unknown CLI: {slug}")
    return payload
