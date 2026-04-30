from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


SlashTargetId = Literal["opencode", "claude", "cursor", "codex"]
SlashRenderFormat = Literal["frontmatter_markdown", "cursor_plaintext"]
SlashCommandScope = Literal["global", "project"]
SlashSyncStatus = Literal[
    "synced",
    "removed",
    "not_selected",
    "blocked_manual_file",
    "blocked_modified_file",
    "missing",
    "drifted",
    "failed",
]
SlashReviewKind = Literal["unmanaged", "drifted", "missing"]
SlashReviewAction = Literal["import", "restore_managed", "adopt_target", "remove_binding"]
SlashReviewResolveAction = Literal["restore_managed", "adopt_target", "remove_binding"]


class SlashTargetResponse(BaseModel):
    id: SlashTargetId
    label: str
    rootPath: str
    outputDir: str
    invocationPrefix: str
    renderFormat: SlashRenderFormat
    scope: SlashCommandScope
    docsUrl: str
    fileGlob: str
    supportsFrontmatter: bool
    supportNote: str | None = None
    defaultSelected: bool
    enabled: bool
    available: bool


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


class SlashCommandReviewResponse(BaseModel):
    reviewRef: str
    kind: SlashReviewKind
    target: SlashTargetId
    targetLabel: str
    name: str
    path: str
    description: str
    prompt: str
    commandExists: bool
    canImport: bool
    actions: list[SlashReviewAction]
    error: str | None = None


class SlashCommandListResponse(BaseModel):
    storePath: str
    syncStatePath: str
    targets: list[SlashTargetResponse]
    defaultTargets: list[SlashTargetId]
    commands: list[SlashCommandResponse]
    reviewCommands: list[SlashCommandReviewResponse]


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


class SlashCommandImportRequest(BaseModel):
    target: SlashTargetId
    name: str = Field(..., min_length=1)


class SlashCommandResolveRequest(BaseModel):
    target: SlashTargetId
    name: str = Field(..., min_length=1)
    action: SlashReviewResolveAction


class SlashCommandMutationResponse(BaseModel):
    ok: bool
    command: SlashCommandResponse | None
    sync: list[SlashSyncEntryResponse]


class SlashCommandDeleteResponse(BaseModel):
    ok: bool
    sync: list[SlashSyncEntryResponse]


__all__ = [
    "SlashCommandDeleteResponse",
    "SlashCommandScope",
    "SlashCommandImportRequest",
    "SlashCommandListResponse",
    "SlashCommandMutationRequest",
    "SlashCommandMutationResponse",
    "SlashCommandResolveRequest",
    "SlashCommandResponse",
    "SlashCommandReviewResponse",
    "SlashCommandUpdateRequest",
    "SlashReviewAction",
    "SlashReviewKind",
    "SlashReviewResolveAction",
    "SlashRenderFormat",
    "SlashSyncEntryResponse",
    "SlashSyncRequest",
    "SlashSyncStatus",
    "SlashTargetId",
    "SlashTargetResponse",
]
