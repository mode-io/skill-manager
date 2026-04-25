from __future__ import annotations

from pydantic import BaseModel, Field


class HarnessTarget(BaseModel):
    harness: str = Field(..., min_length=1, description="Harness identifier")


class SetHarnessSupportRequest(BaseModel):
    enabled: bool


class OkResponse(BaseModel):
    ok: bool


__all__ = ["HarnessTarget", "OkResponse", "SetHarnessSupportRequest"]
