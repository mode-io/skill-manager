export { invalidateMarketplaceQueries, marketplaceKeys } from "./api/queries";
export { cliMarketplaceKeys } from "./api/cli-queries";
export { mcpMarketplaceKeys } from "./api/mcp-queries";

export const marketplaceRoutes = {
  skills: "/marketplace/skills",
  mcp: "/marketplace/mcp",
  clis: "/marketplace/clis",
} as const;
