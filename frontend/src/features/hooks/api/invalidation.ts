import type { QueryClient } from "@tanstack/react-query";

import { hooksManagementKeys } from "./keys";

export async function invalidateHooksQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: hooksManagementKeys.all });
}
