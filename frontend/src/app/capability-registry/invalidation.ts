import type { QueryClient } from "@tanstack/react-query";

import { invalidateMarketplaceQueries } from "../../features/marketplace/public";
import { invalidateMcpQueries } from "../../features/mcp/public";
import { invalidateSettingsQueries } from "../../features/settings/public";
import { invalidateSkillsQueries } from "../../features/skills/public";

export async function invalidateCapabilityQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    invalidateSkillsQueries(queryClient),
    invalidateMcpQueries(queryClient),
    invalidateSettingsQueries(queryClient),
    invalidateMarketplaceQueries(queryClient),
  ]);
}
