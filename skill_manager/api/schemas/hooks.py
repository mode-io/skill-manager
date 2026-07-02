from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .common import HarnessTarget


class AddHookRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    id: str = Field(..., min_length=1)
    event: str = Field(..., min_length=1)
    command: str = Field(..., min_length=1)
    match: str | None = None
    timeout: int | None = None
    description: str = ""


class EnableHookRequest(HarnessTarget):
    pass


class DisableHookRequest(HarnessTarget):
    pass


class SetHookHarnessesRequest(BaseModel):
    target: Literal["enabled", "disabled"]


class ReconcileHookRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    source_kind: Literal["managed", "harness"] = Field(..., alias="sourceKind")
    observed_harness: str | None = Field(
        default=None,
        alias="observedHarness",
        title="Observed harness",
    )
    harnesses: list[str] | None = None


class HookSpecResponse(BaseModel):
    id: str
    event: str
    command: str
    match: str | None = None
    timeout: int | None = None
    description: str
    installedAt: str
    revision: str


class HookInventoryColumnResponse(BaseModel):
    harness: str
    label: str
    logoKey: str | None = None
    installed: bool
    configPresent: bool
    hooksWritable: bool = True
    hooksUnavailableReason: str | None = None


class HookInventoryIssueResponse(BaseModel):
    name: str
    reason: str


class HookBindingResponse(BaseModel):
    harness: str
    state: Literal["managed", "drifted", "unmanaged", "missing", "unsupported"]
    driftDetail: str | None = None
    caveat: str | None = None


class HookInventoryEntryResponse(BaseModel):
    id: str
    displayName: str
    kind: Literal["managed", "unmanaged"]
    spec: HookSpecResponse | None = None
    canEnable: bool
    enabledStatus: Literal["enabled", "disabled"]
    sightings: list[HookBindingResponse]


class HookInventoryResponse(BaseModel):
    columns: list[HookInventoryColumnResponse]
    entries: list[HookInventoryEntryResponse]
    issues: list[HookInventoryIssueResponse] = Field(default_factory=list)


class HookMutationFailureResponse(BaseModel):
    harness: str
    error: str


class HookSetHarnessesResultResponse(BaseModel):
    ok: bool
    succeeded: list[str]
    failed: list[HookMutationFailureResponse]


class HookMutationResponse(BaseModel):
    ok: bool
    hook: HookSpecResponse


class HookApplyConfigResponse(BaseModel):
    ok: bool
    hook: HookSpecResponse
    succeeded: list[str]
    failed: list[HookMutationFailureResponse]


__all__ = [
    "AddHookRequest",
    "DisableHookRequest",
    "EnableHookRequest",
    "HookApplyConfigResponse",
    "HookBindingResponse",
    "HookInventoryColumnResponse",
    "HookInventoryEntryResponse",
    "HookInventoryIssueResponse",
    "HookInventoryResponse",
    "HookMutationFailureResponse",
    "HookMutationResponse",
    "HookSetHarnessesResultResponse",
    "HookSpecResponse",
    "ReconcileHookRequest",
    "SetHookHarnessesRequest",
]
