import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { fetchSettings } from "../../api/client";
import { manageAllSkills } from "../skills/api/client";
import { invalidateSkillsQueries } from "../skills/api/queries";

const SETTINGS_STALE_TIME_MS = 60_000;
const SETTINGS_GC_TIME_MS = 15 * 60_000;

export const settingsKeys = {
  all: ["settings"] as const,
  detail: () => ["settings", "detail"] as const,
};

export function useSettingsQuery(enabled: boolean) {
  return useQuery({
    queryKey: settingsKeys.detail(),
    queryFn: fetchSettings,
    enabled,
    staleTime: SETTINGS_STALE_TIME_MS,
    gcTime: SETTINGS_GC_TIME_MS,
    refetchOnWindowFocus: false,
  });
}

export async function invalidateSettingsQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: settingsKeys.all });
}

export function useManageAllFromSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: manageAllSkills,
    onSuccess: async () => {
      await Promise.all([
        invalidateSkillsQueries(queryClient),
        invalidateSettingsQueries(queryClient),
      ]);
    },
  });
}
