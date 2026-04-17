from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class HarnessTarget(BaseModel):
    harness: str = Field(..., min_length=1, description="Harness identifier")


class EnableSkillRequest(HarnessTarget):
    pass


class DisableSkillRequest(HarnessTarget):
    pass


class InstallMarketplaceSkillRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    install_token: str = Field(..., alias="installToken", min_length=1)


class SetHarnessSupportRequest(BaseModel):
    enabled: bool
