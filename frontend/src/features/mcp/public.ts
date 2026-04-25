export {
  useAdoptMcpServerMutation,
  useDisableMcpServerMutation,
  useEnableMcpServerMutation,
  useMcpInventoryQuery,
  useMcpNeedsReviewByServerQuery,
  useMcpServerDetailQuery,
  useReconcileMcpServerMutation,
  useSetMcpServerHarnessesMutation,
  useUninstallMcpServerMutation,
} from "./api/management-queries";
export { invalidateMcpQueries } from "./api/invalidation";
export { mcpManagementKeys } from "./api/keys";
export type {
  McpBindingDto,
  McpIdentitySightingDto,
  McpInventoryColumnDto,
  McpInventoryDto,
  McpInventoryEntryDto,
} from "./api/management-types";
export { isMcpHarnessAddressable } from "./model/selectors";

export const mcpRoutes = {
  inUse: "/mcp/use",
  needsReview: "/mcp/review",
  marketplace: "/marketplace/mcp",
} as const;
