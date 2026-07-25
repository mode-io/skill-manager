import type { QueryClient } from "@tanstack/react-query";

import { permissionsManagementKeys } from "./keys";

export async function invalidatePermissionsQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: permissionsManagementKeys.all });
}
