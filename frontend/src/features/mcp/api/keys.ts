export const MCP_STALE_TIME_MS = 30_000;
export const MCP_GC_TIME_MS = 5 * 60_000;

export const mcpManagementKeys = {
  all: ["mcp"] as const,
  inventory: () => ["mcp", "inventory"] as const,
  needsReviewByServer: () => ["mcp", "needs-review", "by-server"] as const,
  detail: (name: string) => ["mcp", "detail", name] as const,
};
