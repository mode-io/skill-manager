from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .common import HarnessTarget


class EnableSkillRequest(HarnessTarget):
    pass


class DisableSkillRequest(HarnessTarget):
    pass


class SetSkillHarnessesRequest(BaseModel):
    target: Literal["enabled", "disabled"] = Field(
        ...,
        description="Target state to apply to every interactive harness cell on this skill",
    )


class InstallMarketplaceSkillRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    install_token: str = Field(..., alias="installToken", min_length=1)


SkillStatus = Literal["Managed", "Unmanaged"]
HarnessCellState = Literal["enabled", "disabled", "found", "empty"]
SkillUpdateStatus = Literal[
    "update_available",
    "no_update_available",
    "no_source_available",
    "local_changes_detected",
]
SkillStopManagingStatus = Literal["available", "disabled_no_enabled"]


class SetSkillHarnessesFailureResponse(BaseModel):
    harness: str
    error: str


class SetSkillHarnessesResultResponse(BaseModel):
    ok: bool
    succeeded: list[str]
    failed: list[SetSkillHarnessesFailureResponse]


class BulkManageFailureResponse(BaseModel):
    skillRef: str
    name: str
    error: str


class BulkManageResultResponse(BaseModel):
    ok: bool
    managedCount: int
    skippedCount: int
    failures: list[BulkManageFailureResponse]


class SkillsSummaryResponse(BaseModel):
    managed: int
    unmanaged: int


class HarnessColumnResponse(BaseModel):
    harness: str
    label: str
    logoKey: str | None = None
    installed: bool


class SkillRowActionsResponse(BaseModel):
    canManage: bool
    canStopManaging: bool
    canDelete: bool


class HarnessCellResponse(BaseModel):
    harness: str
    label: str
    logoKey: str | None = None
    state: HarnessCellState
    interactive: bool


class SkillTableRowResponse(BaseModel):
    skillRef: str
    name: str
    description: str
    displayStatus: SkillStatus
    actions: SkillRowActionsResponse
    cells: list[HarnessCellResponse]


class SkillsPageResponse(BaseModel):
    summary: SkillsSummaryResponse
    harnessColumns: list[HarnessColumnResponse]
    rows: list[SkillTableRowResponse]


class SkillDetailActionsResponse(BaseModel):
    canManage: bool
    stopManagingStatus: SkillStopManagingStatus | None
    stopManagingHarnessLabels: list[str]
    canDelete: bool
    deleteHarnessLabels: list[str]


class SkillLocationResponse(BaseModel):
    kind: Literal["shared", "harness"]
    harness: str | None
    label: str
    scope: str | None
    path: str | None
    revision: str | None
    sourceKind: str
    sourceLocator: str
    detail: str | None


class SkillSourceLinksResponse(BaseModel):
    repoLabel: str
    repoUrl: str
    folderUrl: str | None


class SkillDetailResponse(BaseModel):
    skillRef: str
    name: str
    description: str
    displayStatus: SkillStatus
    attentionMessage: str | None
    actions: SkillDetailActionsResponse
    harnessCells: list[HarnessCellResponse]
    locations: list[SkillLocationResponse]
    sourceLinks: SkillSourceLinksResponse | None
    documentMarkdown: str | None


class SkillSourceStatusResponse(BaseModel):
    updateStatus: SkillUpdateStatus | None


__all__ = [
    "BulkManageFailureResponse",
    "BulkManageResultResponse",
    "DisableSkillRequest",
    "EnableSkillRequest",
    "HarnessCellResponse",
    "HarnessCellState",
    "HarnessColumnResponse",
    "InstallMarketplaceSkillRequest",
    "SetSkillHarnessesFailureResponse",
    "SetSkillHarnessesRequest",
    "SetSkillHarnessesResultResponse",
    "SkillDetailActionsResponse",
    "SkillDetailResponse",
    "SkillLocationResponse",
    "SkillRowActionsResponse",
    "SkillSourceLinksResponse",
    "SkillSourceStatusResponse",
    "SkillStatus",
    "SkillStopManagingStatus",
    "SkillTableRowResponse",
    "SkillUpdateStatus",
    "SkillsPageResponse",
    "SkillsSummaryResponse",
]
