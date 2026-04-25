import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { flattenUniquePageItems, queryPolicy } from "../../../lib/query";
import {
  fetchCliMarketplaceDetail,
  fetchCliMarketplacePopular,
  searchCliMarketplace,
} from "./cli-client";
import type {
  CliMarketplaceItemDto,
  CliMarketplacePageResultDto,
} from "./cli-types";

const CLI_MARKETPLACE_STALE_TIME_MS = 60_000;
const CLI_MARKETPLACE_GC_TIME_MS = 15 * 60_000;
const PAGE_SIZE = 30;

export const cliMarketplaceKeys = {
  all: ["marketplace", "clis"] as const,
  feed: (query: string) => ["marketplace", "clis", "feed", query] as const,
  detail: (idOrSlug: string) => ["marketplace", "clis", "detail", idOrSlug] as const,
};

export function useCliMarketplaceFeedQuery(query: string) {
  const trimmed = query.trim();

  return useInfiniteQuery({
    queryKey: cliMarketplaceKeys.feed(trimmed || "__popular__"),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      trimmed
        ? searchCliMarketplace({ query: trimmed, limit: PAGE_SIZE, offset: pageParam })
        : fetchCliMarketplacePopular({ limit: PAGE_SIZE, offset: pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextOffset ?? undefined : undefined,
    ...queryPolicy(CLI_MARKETPLACE_STALE_TIME_MS, CLI_MARKETPLACE_GC_TIME_MS),
  });
}

export function useCliMarketplaceDetailQuery(idOrSlug: string | null) {
  return useQuery({
    queryKey: cliMarketplaceKeys.detail(idOrSlug ?? "__none__"),
    queryFn: () => fetchCliMarketplaceDetail(idOrSlug!),
    enabled: Boolean(idOrSlug),
    ...queryPolicy(CLI_MARKETPLACE_STALE_TIME_MS, CLI_MARKETPLACE_GC_TIME_MS),
  });
}

export function flattenCliMarketplaceItems(
  data: { pages: CliMarketplacePageResultDto[] } | undefined,
): CliMarketplaceItemDto[] {
  return flattenUniquePageItems(data, (item) => item.id);
}
