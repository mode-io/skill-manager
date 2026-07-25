from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .common import HarnessTarget


class AddPermissionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    id: str = Field(..., min_length=1)
    decision: str = Field(..., min_length=1)
    scope: str = Field(..., min_length=1)
    pattern: str | None = None
    description: str = ""


class EnablePermissionRequest(HarnessTarget):
    pass


class DisablePermissionRequest(HarnessTarget):
    pass


class SetPermissionHarnessesRequest(BaseModel):
    target: Literal["enabled", "disabled"]


class ReconcilePermissionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    source_kind: Literal["managed", "harness"] = Field(..., alias="sourceKind")
    observed_harness: str | None = Field(
        default=None,
        alias="observedHarness",
        title="Observed harness",
    )
    harnesses: list[str] | None = None


class PromotePermissionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    observed_harness: str | None = Field(
        default=None,
        alias="observedHarness",
        title="Observed harness",
    )


class PermissionSpecResponse(BaseModel):
    id: str
    decision: str
    scope: str
    pattern: str | None = None
    description: str
    installedAt: str
    revision: str


class PermissionInventoryColumnResponse(BaseModel):
    harness: str
    label: str
    logoKey: str | None = None
    installed: bool
    configPresent: bool
    permissionsWritable: bool = True
    permissionsUnavailableReason: str | None = None


class PermissionInventoryIssueResponse(BaseModel):
    name: str
    reason: str


class PermissionBindingResponse(BaseModel):
    harness: str
    state: Literal["managed", "drifted", "unmanaged", "missing", "unsupported"]
    driftDetail: str | None = None
    caveat: str | None = None


class PermissionInventoryEntryResponse(BaseModel):
    id: str
    displayName: str
    kind: Literal["managed", "unmanaged"]
    spec: PermissionSpecResponse | None = None
    canEnable: bool
    enabledStatus: Literal["enabled", "disabled"]
    sightings: list[PermissionBindingResponse]


class PermissionInventoryResponse(BaseModel):
    columns: list[PermissionInventoryColumnResponse]
    entries: list[PermissionInventoryEntryResponse]
    issues: list[PermissionInventoryIssueResponse] = Field(default_factory=list)


class PermissionMutationFailureResponse(BaseModel):
    harness: str
    error: str


class PermissionSetHarnessesResultResponse(BaseModel):
    ok: bool
    succeeded: list[str]
    failed: list[PermissionMutationFailureResponse]


class PermissionMutationResponse(BaseModel):
    ok: bool
    permission: PermissionSpecResponse


class PermissionApplyConfigResponse(BaseModel):
    ok: bool
    permission: PermissionSpecResponse
    succeeded: list[str]
    failed: list[PermissionMutationFailureResponse]


__all__ = [
    "AddPermissionRequest",
    "DisablePermissionRequest",
    "EnablePermissionRequest",
    "PermissionApplyConfigResponse",
    "PermissionBindingResponse",
    "PermissionInventoryColumnResponse",
    "PermissionInventoryEntryResponse",
    "PermissionInventoryIssueResponse",
    "PermissionInventoryResponse",
    "PermissionMutationFailureResponse",
    "PermissionMutationResponse",
    "PermissionSetHarnessesResultResponse",
    "PermissionSpecResponse",
    "PromotePermissionRequest",
    "ReconcilePermissionRequest",
    "SetPermissionHarnessesRequest",
]
