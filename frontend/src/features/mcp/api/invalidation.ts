import type { QueryClient } from "@tanstack/react-query";

import { mcpManagementKeys } from "./keys";

export async function invalidateMcpQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: mcpManagementKeys.all });
}
