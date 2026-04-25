import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { queryPolicy } from "../../lib/query";
import { invalidateMcpQueries } from "../mcp/public";
import { invalidateSkillsQueries } from "../skills/public";
import { fetchSettings, updateHarnessSupport } from "./api/client";
import type { SettingsData } from "./api/types";

const SETTINGS_STALE_TIME_MS = 60_000;
const SETTINGS_GC_TIME_MS = 15 * 60_000;

export const settingsKeys = {
  all: ["settings"] as const,
  detail: () => ["settings", "detail"] as const,
};

export function useSettingsQuery() {
  return useQuery({
    queryKey: settingsKeys.detail(),
    queryFn: fetchSettings,
    ...queryPolicy(SETTINGS_STALE_TIME_MS, SETTINGS_GC_TIME_MS),
  });
}

export async function invalidateSettingsQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: settingsKeys.all });
}

export function useHarnessSupportMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ harness, enabled }: { harness: string; enabled: boolean }) =>
      updateHarnessSupport(harness, enabled),
    onMutate: async ({ harness, enabled }) => {
      await queryClient.cancelQueries({ queryKey: settingsKeys.detail() });
      const previousSettings = queryClient.getQueryData<SettingsData>(settingsKeys.detail());
      if (previousSettings) {
        queryClient.setQueryData<SettingsData>(settingsKeys.detail(), {
          ...previousSettings,
          harnesses: previousSettings.harnesses.map((item) =>
            item.harness === harness
              ? {
                  ...item,
                  supportEnabled: enabled,
                }
              : item,
          ),
        });
      }
      return { previousSettings };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(settingsKeys.detail(), context.previousSettings);
      }
    },
    onSuccess: async () => {
      await Promise.all([
        invalidateSkillsQueries(queryClient),
        invalidateMcpQueries(queryClient),
        invalidateSettingsQueries(queryClient),
      ]);
    },
  });
}
