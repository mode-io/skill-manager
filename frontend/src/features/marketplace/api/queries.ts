import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { flattenUniquePageItems, queryPolicy } from "../../../lib/query";
import { invalidateSettingsQueries } from "../../settings/public";
import { invalidateSkillsQueries } from "../../skills/public";
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
  document: (itemId: string) => ["marketplace", "document", itemId] as const,
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
    ...queryPolicy(MARKETPLACE_STALE_TIME_MS, MARKETPLACE_GC_TIME_MS),
  });
}

export function useMarketplaceDetailQuery(itemId: string | null) {
  return useQuery({
    queryKey: marketplaceKeys.detail(itemId ?? "__none__"),
    queryFn: () => fetchMarketplaceDetail(itemId!),
    enabled: Boolean(itemId),
    ...queryPolicy(MARKETPLACE_STALE_TIME_MS, MARKETPLACE_GC_TIME_MS),
  });
}

export function useMarketplaceDocumentQuery(itemId: string | null) {
  return useQuery({
    queryKey: marketplaceKeys.document(itemId ?? "__none__"),
    queryFn: () => fetchMarketplaceDocument(itemId!),
    enabled: Boolean(itemId),
    ...queryPolicy(MARKETPLACE_STALE_TIME_MS, MARKETPLACE_GC_TIME_MS),
  });
}

export async function invalidateMarketplaceQueries(queryClient: import("@tanstack/react-query").QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: marketplaceKeys.all });
}

export function flattenMarketplaceItems(data: { pages: MarketplacePageResultDto[] } | undefined): MarketplaceItemDto[] {
  return flattenUniquePageItems(data, (item) => item.id);
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
