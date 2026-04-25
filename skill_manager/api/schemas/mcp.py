from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .common import HarnessTarget


class AddMcpServerRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    qualified_name: str = Field(..., alias="qualifiedName", min_length=1)
    source_harness: str = Field(..., alias="sourceHarness", min_length=1)


class EnableMcpServerRequest(HarnessTarget):
    pass


class DisableMcpServerRequest(HarnessTarget):
    pass


class SetMcpServerHarnessesRequest(BaseModel):
    target: Literal["enabled", "disabled"]


class AdoptMcpRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    name: str = Field(..., min_length=1)
    source_harness: str | None = Field(default=None, alias="sourceHarness")
    harnesses: list[str] | None = None


class ReconcileMcpServerRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    source_kind: Literal["managed", "harness"] = Field(..., alias="sourceKind")
    source_harness: str | None = Field(default=None, alias="sourceHarness")
    harnesses: list[str] | None = None


class McpSourceResponse(BaseModel):
    kind: Literal["marketplace", "adopted", "manual"]
    locator: str


class McpServerSpecResponse(BaseModel):
    name: str
    displayName: str
    source: McpSourceResponse
    transport: Literal["stdio", "http", "sse"]
    command: str | None = None
    args: list[str] | None = None
    env: dict[str, str] | None = None
    url: str | None = None
    headers: dict[str, str] | None = None
    installedAt: str
    revision: str


class McpInventoryColumnResponse(BaseModel):
    harness: str
    label: str
    logoKey: str | None = None
    installed: bool
    configPresent: bool
    mcpWritable: bool = True
    mcpUnavailableReason: str | None = None


class McpInventoryIssueResponse(BaseModel):
    name: str
    reason: str


class McpBindingResponse(BaseModel):
    harness: str
    state: Literal["managed", "drifted", "unmanaged", "missing"]
    driftDetail: str | None = None


class McpInventoryEntryResponse(BaseModel):
    name: str
    displayName: str
    kind: Literal["managed", "unmanaged"]
    spec: McpServerSpecResponse | None = None
    canEnable: bool
    sightings: list[McpBindingResponse]


class McpInventoryResponse(BaseModel):
    columns: list[McpInventoryColumnResponse]
    entries: list[McpInventoryEntryResponse]
    issues: list[McpInventoryIssueResponse] = Field(default_factory=list)


class McpMutationFailureResponse(BaseModel):
    harness: str
    error: str


class McpSetHarnessesResultResponse(BaseModel):
    ok: bool
    succeeded: list[str]
    failed: list[McpMutationFailureResponse]


class McpServerMutationResponse(BaseModel):
    ok: bool
    server: McpServerSpecResponse


class McpApplyConfigResponse(BaseModel):
    ok: bool
    server: McpServerSpecResponse
    succeeded: list[str]
    failed: list[McpMutationFailureResponse]


class McpEnvEntryResponse(BaseModel):
    key: str
    value: str | None = None
    isEnvRef: bool


class McpConfigChoiceResponse(BaseModel):
    sourceKind: Literal["managed", "harness"]
    sourceHarness: str | None = None
    label: str
    logoKey: str | None = None
    configPath: str | None = None
    payloadPreview: dict[str, object]
    spec: McpServerSpecResponse
    env: list[McpEnvEntryResponse] = Field(default_factory=list)


class McpMarketplaceLinkResponse(BaseModel):
    qualifiedName: str
    displayName: str
    iconUrl: str | None = None
    externalUrl: str
    description: str
    isRemote: bool
    isVerified: bool


class McpServerDetailResponse(McpInventoryEntryResponse):
    env: list[McpEnvEntryResponse] = Field(default_factory=list)
    configChoices: list[McpConfigChoiceResponse] = Field(default_factory=list)
    marketplaceLink: McpMarketplaceLinkResponse | None = None


class McpUnmanagedHarnessResponse(BaseModel):
    harness: str
    label: str
    logoKey: str | None = None
    installed: bool
    configPresent: bool
    mcpWritable: bool = True
    mcpUnavailableReason: str | None = None
    configPath: str | None = None


class McpIdentitySightingResponse(BaseModel):
    harness: str
    label: str
    logoKey: str | None = None
    configPath: str | None = None
    payloadPreview: dict[str, object]
    spec: McpServerSpecResponse
    env: list[McpEnvEntryResponse] = Field(default_factory=list)


class McpAdoptionIssueResponse(BaseModel):
    harness: str
    label: str
    logoKey: str | None = None
    name: str
    configPath: str | None = None
    payloadPreview: dict[str, object] | None = None
    reason: str


class McpIdentityGroupResponse(BaseModel):
    name: str
    identical: bool
    canonicalSpec: McpServerSpecResponse | None = None
    sightings: list[McpIdentitySightingResponse]
    marketplaceLink: McpMarketplaceLinkResponse | None = None


class McpUnmanagedByServerResponse(BaseModel):
    harnesses: list[McpUnmanagedHarnessResponse]
    servers: list[McpIdentityGroupResponse]
    issues: list[McpAdoptionIssueResponse] = Field(default_factory=list)


class McpMarketplaceItemResponse(BaseModel):
    qualifiedName: str
    namespace: str
    displayName: str
    description: str
    iconUrl: str | None = None
    isVerified: bool
    isRemote: bool
    isDeployed: bool
    useCount: int
    createdAt: str | None = None
    homepage: str | None = None
    externalUrl: str


class McpMarketplacePageResponse(BaseModel):
    items: list[McpMarketplaceItemResponse]
    nextOffset: int | None = None
    hasMore: bool


class McpInstallTargetResponse(BaseModel):
    harness: str
    label: str
    logoKey: str | None = None
    smitheryClient: str | None = None
    supported: bool
    reason: str | None = None


class McpInstallTargetsResponse(BaseModel):
    targets: list[McpInstallTargetResponse]


class McpMarketplaceConnectionResponse(BaseModel):
    kind: str
    deploymentUrl: str | None = None
    configSchema: dict[str, object] | None = None
    stdioFunction: str | None = None
    bundleUrl: str | None = None
    runtime: str | None = None
    stdioCommand: str | None = None
    stdioArgs: list[str] | None = None


class McpMarketplaceParameterResponse(BaseModel):
    name: str
    type: str
    description: str
    required: bool
    default: object | None = None
    minimum: float | int | None = None
    maximum: float | int | None = None
    minItems: int | None = None
    maxItems: int | None = None
    minLength: int | None = None
    maxLength: int | None = None
    enum: list[object] | None = None


class McpMarketplaceToolResponse(BaseModel):
    name: str
    description: str
    parameters: list[McpMarketplaceParameterResponse]


class McpMarketplaceResourceResponse(BaseModel):
    name: str
    uri: str
    description: str
    mimeType: str | None = None


class McpMarketplacePromptArgumentResponse(BaseModel):
    name: str
    description: str
    required: bool


class McpMarketplacePromptResponse(BaseModel):
    name: str
    description: str
    arguments: list[McpMarketplacePromptArgumentResponse]


class McpMarketplaceCapabilityCountsResponse(BaseModel):
    tools: int
    resources: int
    prompts: int


class McpMarketplaceDetailResponse(BaseModel):
    qualifiedName: str
    managedName: str
    displayName: str
    description: str
    iconUrl: str | None = None
    isRemote: bool
    deploymentUrl: str | None = None
    connections: list[McpMarketplaceConnectionResponse]
    tools: list[McpMarketplaceToolResponse]
    resources: list[McpMarketplaceResourceResponse]
    prompts: list[McpMarketplacePromptResponse]
    capabilityCounts: McpMarketplaceCapabilityCountsResponse
    externalUrl: str


__all__ = [
    "AdoptMcpRequest",
    "DisableMcpServerRequest",
    "EnableMcpServerRequest",
    "AddMcpServerRequest",
    "McpServerMutationResponse",
    "McpApplyConfigResponse",
    "McpAdoptionIssueResponse",
    "McpBindingResponse",
    "McpConfigChoiceResponse",
    "McpEnvEntryResponse",
    "McpIdentityGroupResponse",
    "McpIdentitySightingResponse",
    "McpInventoryColumnResponse",
    "McpInventoryIssueResponse",
    "McpInventoryEntryResponse",
    "McpInventoryResponse",
    "McpInstallTargetResponse",
    "McpInstallTargetsResponse",
    "McpMarketplaceCapabilityCountsResponse",
    "McpMarketplaceConnectionResponse",
    "McpMarketplaceDetailResponse",
    "McpMarketplaceItemResponse",
    "McpMarketplaceLinkResponse",
    "McpMarketplacePageResponse",
    "McpMarketplaceParameterResponse",
    "McpMarketplacePromptArgumentResponse",
    "McpMarketplacePromptResponse",
    "McpMarketplaceResourceResponse",
    "McpMarketplaceToolResponse",
    "McpMutationFailureResponse",
    "McpServerDetailResponse",
    "McpServerSpecResponse",
    "McpSetHarnessesResultResponse",
    "McpSourceResponse",
    "McpUnmanagedByServerResponse",
    "McpUnmanagedHarnessResponse",
    "ReconcileMcpServerRequest",
    "SetMcpServerHarnessesRequest",
]
