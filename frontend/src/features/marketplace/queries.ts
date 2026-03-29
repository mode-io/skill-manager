import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { fetchMarketplacePopular, installSkill, searchMarketplace } from "../../api/client";
import type { MarketplaceItem, MarketplacePageResult } from "../../api/types";
import { invalidateSettingsQueries } from "../settings/queries";
import { invalidateSkillsQueries } from "../skills/queries";

const MARKETPLACE_STALE_TIME_MS = 60_000;
const MARKETPLACE_GC_TIME_MS = 15 * 60_000;

export const marketplaceKeys = {
  all: ["marketplace"] as const,
  feed: (query: string) => ["marketplace", "feed", query] as const,
};

export function useMarketplaceFeedQuery(query: string) {
  const trimmed = query.trim();

  return useInfiniteQuery({
    queryKey: marketplaceKeys.feed(trimmed || "__popular__"),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      trimmed
        ? searchMarketplace(trimmed, { limit: 20, offset: pageParam })
        : fetchMarketplacePopular({ limit: 20, offset: pageParam }),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextOffset ?? undefined : undefined),
    staleTime: MARKETPLACE_STALE_TIME_MS,
    gcTime: MARKETPLACE_GC_TIME_MS,
    refetchOnWindowFocus: false,
  });
}

export function flattenMarketplaceItems(data: { pages: MarketplacePageResult[] } | undefined): MarketplaceItem[] {
  if (!data) {
    return [];
  }

  const seen = new Set<string>();
  const items: MarketplaceItem[] = [];
  for (const page of data.pages) {
    for (const item of page.items) {
      if (seen.has(item.id)) {
        continue;
      }
      seen.add(item.id);
      items.push(item);
    }
  }
  return items;
}

export function useInstallMarketplaceSkillMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ installToken }: { installToken: string }) => installSkill(installToken),
    onSuccess: async () => {
      await Promise.all([
        invalidateSkillsQueries(queryClient),
        invalidateSettingsQueries(queryClient),
      ]);
    },
  });
}
