from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


SlashTargetId = Literal["opencode", "claude", "cursor", "codex"]
SlashSyncStatus = Literal["synced", "removed", "not_selected", "blocked_manual_file", "failed"]


class SlashTargetResponse(BaseModel):
    id: SlashTargetId
    label: str
    rootPath: str
    outputDir: str
    invocationPrefix: str
    defaultSelected: bool


class SlashSyncEntryResponse(BaseModel):
    target: SlashTargetId
    path: str
    status: SlashSyncStatus
    error: str | None = None


class SlashCommandResponse(BaseModel):
    name: str
    description: str
    prompt: str
    syncTargets: list[SlashSyncEntryResponse]


class SlashCommandListResponse(BaseModel):
    storePath: str
    syncStatePath: str
    targets: list[SlashTargetResponse]
    defaultTargets: list[SlashTargetId]
    commands: list[SlashCommandResponse]
    reviewCommands: list["SlashCommandReviewResponse"]


class SlashCommandMutationRequest(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)
    targets: list[SlashTargetId] | None = None


class SlashCommandUpdateRequest(BaseModel):
    description: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)
    targets: list[SlashTargetId] | None = None


class SlashSyncRequest(BaseModel):
    targets: list[SlashTargetId] | None = None


class SlashCommandReviewResponse(BaseModel):
    reviewRef: str
    target: SlashTargetId
    targetLabel: str
    name: str
    path: str
    description: str
    prompt: str
    commandExists: bool
    canImport: bool
    error: str | None = None


class SlashCommandImportRequest(BaseModel):
    target: SlashTargetId
    name: str = Field(..., min_length=1)


class SlashCommandMutationResponse(BaseModel):
    ok: bool
    command: SlashCommandResponse | None
    sync: list[SlashSyncEntryResponse]


class SlashCommandDeleteResponse(BaseModel):
    ok: bool
    sync: list[SlashSyncEntryResponse]


__all__ = [
    "SlashCommandDeleteResponse",
    "SlashCommandListResponse",
    "SlashCommandImportRequest",
    "SlashCommandMutationRequest",
    "SlashCommandMutationResponse",
    "SlashCommandReviewResponse",
    "SlashCommandResponse",
    "SlashCommandUpdateRequest",
    "SlashSyncEntryResponse",
    "SlashSyncRequest",
    "SlashSyncStatus",
    "SlashTargetId",
    "SlashTargetResponse",
]
