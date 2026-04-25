from __future__ import annotations

from fastapi import APIRouter

from . import marketplace_clis, marketplace_mcp, marketplace_skills

router = APIRouter()
router.include_router(marketplace_skills.router)
router.include_router(marketplace_mcp.router)
router.include_router(marketplace_clis.router)
