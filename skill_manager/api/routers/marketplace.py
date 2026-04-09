from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from skill_manager.application import BackendContainer
from skill_manager.api.deps import get_container

router = APIRouter(prefix="/api/marketplace")


@router.get("/popular")
def popular_marketplace(
    limit: int | None = Query(default=None),
    offset: int = Query(default=0),
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    return container.marketplace_queries.popular_page(limit=limit, offset=offset)


@router.get("/search")
def search_marketplace(
    q: str = Query(...),
    limit: int | None = Query(default=None),
    offset: int = Query(default=0),
    container: BackendContainer = Depends(get_container),
) -> dict[str, object]:
    try:
        return container.marketplace_queries.search_page(q, limit=limit, offset=offset)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/items/{item_id:path}/document")
def get_marketplace_document(item_id: str, container: BackendContainer = Depends(get_container)) -> dict[str, object]:
    payload = container.marketplace_queries.get_item_document(item_id)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"unknown marketplace item: {item_id}")
    return payload


@router.get("/items/{item_id:path}")
def get_marketplace_detail(item_id: str, container: BackendContainer = Depends(get_container)) -> dict[str, object]:
    payload = container.marketplace_queries.get_item_detail(item_id)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"unknown marketplace item: {item_id}")
    return payload


@router.post("/install")
def install_marketplace_skill(
    body: dict[str, str] | None = Body(default=None),
    container: BackendContainer = Depends(get_container),
) -> dict[str, bool]:
    install_token = body.get("installToken", "") if isinstance(body, dict) else ""
    if not install_token:
        raise HTTPException(status_code=400, detail="missing installToken")
    return container.marketplace_installs.install_skill(install_token)
