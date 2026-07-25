import { useAgentsInventoryQuery } from "./api/queries";
import { invalidateAgentsQueries } from "./api/invalidation";
import type { AgentInventoryDto } from "./api/types";

export const agentsRoutes = {
  inUse: "/agents/use",
  needsReview: "/agents/review",
} as const;

export { useAgentsInventoryQuery, invalidateAgentsQueries, type AgentInventoryDto };
