import type { components } from "../../../api/generated";

export type McpMarketplaceItemDto = components["schemas"]["McpMarketplaceItemResponse"];
export type McpMarketplacePageResultDto = components["schemas"]["McpMarketplacePageResponse"];
export type McpConnectionKind = components["schemas"]["McpMarketplaceConnectionResponse"]["kind"];
export type McpConnectionDto = components["schemas"]["McpMarketplaceConnectionResponse"];
export type McpParameterDto = components["schemas"]["McpMarketplaceParameterResponse"];
export type McpToolDto = components["schemas"]["McpMarketplaceToolResponse"];
export type McpResourceDto = components["schemas"]["McpMarketplaceResourceResponse"];
export type McpPromptArgumentDto = components["schemas"]["McpMarketplacePromptArgumentResponse"];
export type McpPromptDto = components["schemas"]["McpMarketplacePromptResponse"];
export type McpCapabilityCountsDto = components["schemas"]["McpMarketplaceCapabilityCountsResponse"];
export type McpMarketplaceDetailDto = components["schemas"]["McpMarketplaceDetailResponse"];
export type McpInstallTargetDto = components["schemas"]["McpInstallTargetResponse"];
export type McpInstallTargetsDto = components["schemas"]["McpInstallTargetsResponse"];
export type McpMarketplaceFilter = "all" | "remote" | "local" | "verified";
export type AddMcpServerRequestDto = components["schemas"]["AddMcpServerRequest"];
export type AddMcpServerResponseDto = components["schemas"]["McpServerMutationResponse"];
