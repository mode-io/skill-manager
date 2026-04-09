import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { invalidateSettingsQueries } from "../../settings/queries";
import { invalidateSkillsQueries } from "../../skills/api/queries";
import {
  fetchMarketplaceDetail,
  fetchMarketplaceDocument,
  fetchMarketplacePopular,
  installMarketplaceSkill,
  searchMarketplace,
} from "./client";
import type { MarketplaceItemDto, MarketplacePageResultDto } from "./types";

const MARKETPLACE_STALE_TIME_MS = 60_000;
const MARKETPLACE_GC_TIME_MS = 15 * 60_000;

export const marketplaceKeys = {
  all: ["marketplace"] as const,
  feed: (query: string) => ["marketplace", "feed", query] as const,
  detail: (itemId: string) => ["marketplace", "detail", itemId] as const,
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

export function useMarketplaceDetailQuery(itemId: string | null) {
  return useQuery({
    queryKey: marketplaceKeys.detail(itemId ?? "__none__"),
    queryFn: () => fetchMarketplaceDetail(itemId!),
    enabled: Boolean(itemId),
    staleTime: MARKETPLACE_STALE_TIME_MS,
    gcTime: MARKETPLACE_GC_TIME_MS,
    refetchOnWindowFocus: false,
  });
}

export function useMarketplaceDocumentQuery(itemId: string | null) {
  return useQuery({
    queryKey: ["marketplace", "document", itemId ?? "__none__"],
    queryFn: () => fetchMarketplaceDocument(itemId!),
    enabled: Boolean(itemId),
    staleTime: MARKETPLACE_STALE_TIME_MS,
    gcTime: MARKETPLACE_GC_TIME_MS,
    refetchOnWindowFocus: false,
  });
}

export function flattenMarketplaceItems(data: { pages: MarketplacePageResultDto[] } | undefined): MarketplaceItemDto[] {
  if (!data) {
    return [];
  }

  const seen = new Set<string>();
  const items: MarketplaceItemDto[] = [];
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
    mutationFn: ({ installToken }: { installToken: string }) => installMarketplaceSkill(installToken),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: marketplaceKeys.all }),
        invalidateSkillsQueries(queryClient),
        invalidateSettingsQueries(queryClient),
      ]);
    },
  });
}
