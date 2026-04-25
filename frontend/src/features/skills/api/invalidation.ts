import type { QueryClient } from "@tanstack/react-query";

import { skillsKeys } from "./keys";

export async function invalidateSkillsQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: skillsKeys.list() }),
    queryClient.invalidateQueries({ queryKey: skillsKeys.detailPrefix() }),
    queryClient.invalidateQueries({ queryKey: skillsKeys.sourceStatusPrefix() }),
  ]);
}
