import type { QueryClient } from "@tanstack/react-query";
import { agentsKeys } from "./keys";

export function invalidateAgentsQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: agentsKeys.all });
}
