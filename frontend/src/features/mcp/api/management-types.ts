import type { components } from "../../../api/generated";

export type McpBindingState = components["schemas"]["McpBindingResponse"]["state"];
export type McpTransport = components["schemas"]["McpServerSpecResponse"]["transport"];

export type McpInventoryColumnDto = components["schemas"]["McpInventoryColumnResponse"];
export type McpBindingDto = components["schemas"]["McpBindingResponse"];
export type McpServerSpecDto = components["schemas"]["McpServerSpecResponse"];
export type McpInventoryEntryDto = components["schemas"]["McpInventoryEntryResponse"];
export type McpInventoryDto = components["schemas"]["McpInventoryResponse"];
export type McpNeedsReviewHarnessDto = components["schemas"]["McpUnmanagedHarnessResponse"];
export type SetMcpHarnessesResponseDto = components["schemas"]["McpSetHarnessesResultResponse"];
export type UninstallMcpResponseDto = components["schemas"]["McpSetHarnessesResultResponse"];
export type McpApplyConfigResponseDto = components["schemas"]["McpApplyConfigResponse"];
export type McpConfigChoiceDto = components["schemas"]["McpConfigChoiceResponse"];
export type McpEnvEntryDto = components["schemas"]["McpEnvEntryResponse"];
export type McpMarketplaceLinkDto = components["schemas"]["McpMarketplaceLinkResponse"];
export type McpServerDetailDto = components["schemas"]["McpServerDetailResponse"];
export type McpServerMutationResponseDto = components["schemas"]["McpServerMutationResponse"];
export type McpIdentitySightingDto = components["schemas"]["McpIdentitySightingResponse"];
export type McpAdoptionIssueDto = components["schemas"]["McpAdoptionIssueResponse"];
export type McpIdentityGroupDto = components["schemas"]["McpIdentityGroupResponse"];
export type McpNeedsReviewByServerDto = components["schemas"]["McpUnmanagedByServerResponse"];
