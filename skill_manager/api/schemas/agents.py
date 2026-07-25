from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class AgentColumnResponse(BaseModel):
    harness: str
    label: str
    logoKey: str | None = None
    installed: bool


class AgentBindingResponse(BaseModel):
    harness: str
    state: Literal["enabled", "disabled", "unsupported"]
    detail: str | None = None


class AgentActionsResponse(BaseModel):
    canAdopt: bool
    canDelete: bool


class AgentEntryResponse(BaseModel):
    ref: str
    name: str
    description: str
    kind: Literal["managed", "unmanaged"]
    harnessPath: str | None = None
    bindings: list[AgentBindingResponse]
    actions: AgentActionsResponse


class AgentIssueResponse(BaseModel):
    name: str
    reason: str


class AgentInventoryResponse(BaseModel):
    columns: list[AgentColumnResponse]
    entries: list[AgentEntryResponse]
    issues: list[AgentIssueResponse] = Field(default_factory=list)


class AgentHarnessRequest(BaseModel):
    harness: str


class SetAgentHarnessesRequest(BaseModel):
    harnesses: list[str] = Field(default_factory=list)


class AgentMutationFailureResponse(BaseModel):
    harness: str
    error: str


class SetAgentHarnessesResultResponse(BaseModel):
    ok: bool
    succeeded: list[str]
    failed: list[AgentMutationFailureResponse]


class AdoptAgentRequest(BaseModel):
    onConflict: Literal["keep_store", "replace_store"] | None = None


class AdoptAgentConflictResponse(BaseModel):
    """Body of the 409 an unresolved adopt returns. Nothing was mutated; the user decides."""

    conflict: Literal["store-name-exists"] = "store-name-exists"
    slug: str
    storePath: str
    harnessPath: str


class AdoptAgentResponse(BaseModel):
    ok: bool
    ref: str


class AdoptAllSkippedResponse(BaseModel):
    ref: str
    reason: str


class AdoptAllAgentsResponse(BaseModel):
    ok: bool
    adopted: list[str]
    skipped: list[AdoptAllSkippedResponse]


class CreateAgentRequest(BaseModel):
    name: str
    description: str = ""
    prompt: str = ""
    tools: list[str] = Field(default_factory=list)


class UpdateAgentRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    prompt: str | None = None
    tools: list[str] | None = None


class AgentHarnessDetailResponse(BaseModel):
    harness: str
    label: str
    logoKey: str | None = None
    state: Literal["enabled", "disabled", "unsupported"]
    detail: str | None = None
    path: str
    installMethod: Literal["symlink", "rendered", "none"]
    installed: bool


class AgentConfigEntryResponse(BaseModel):
    """One frontmatter key we do not interpret, shown verbatim."""

    key: str
    value: str


class AgentDetailResponse(BaseModel):
    ref: str
    name: str
    description: str
    prompt: str
    tools: list[str]
    document: str
    storePath: str
    harnesses: list[AgentHarnessDetailResponse]
    configuration: list[AgentConfigEntryResponse] = Field(default_factory=list)
    canDelete: bool


__all__ = [
    "AdoptAgentConflictResponse",
    "AdoptAgentRequest",
    "AdoptAgentResponse",
    "AdoptAllAgentsResponse",
    "AdoptAllSkippedResponse",
    "AgentActionsResponse",
    "AgentBindingResponse",
    "AgentColumnResponse",
    "AgentConfigEntryResponse",
    "AgentDetailResponse",
    "AgentEntryResponse",
    "AgentHarnessDetailResponse",
    "AgentHarnessRequest",
    "AgentInventoryResponse",
    "AgentIssueResponse",
    "AgentMutationFailureResponse",
    "CreateAgentRequest",
    "SetAgentHarnessesRequest",
    "SetAgentHarnessesResultResponse",
    "UpdateAgentRequest",
]
