import type { QueryClient } from "@tanstack/react-query";
import { lazy } from "react";

import { fetchCliMarketplacePopular } from "./api/cli-client";
import { cliMarketplaceKeys } from "./api/cli-queries";
import { fetchMarketplacePopular } from "./api/client";
import { fetchMcpMarketplacePopular } from "./api/mcp-client";
import { mcpMarketplaceKeys } from "./api/mcp-queries";
import { marketplaceKeys } from "./api/queries";

const marketplacePageImport = () => import("./screens/MarketplacePage");
const marketplaceMcpPageImport = () => import("./screens/MarketplaceMcpPage");
const marketplaceCliPageImport = () => import("./screens/MarketplaceCliPage");

export const LazyMarketplacePage = lazy(marketplacePageImport);
export const LazyMarketplaceMcpPage = lazy(marketplaceMcpPageImport);
export const LazyMarketplaceCliPage = lazy(marketplaceCliPageImport);

export function prefetchMarketplacePage(): void {
  void marketplacePageImport();
}

export function prefetchMarketplaceMcpPage(): void {
  void marketplaceMcpPageImport();
}

export function prefetchMarketplaceCliPage(): void {
  void marketplaceCliPageImport();
}

export function prefetchMarketplacePopularFeed(queryClient: QueryClient): void {
  void queryClient.prefetchInfiniteQuery({
    queryKey: marketplaceKeys.feed("__popular__"),
    queryFn: ({ pageParam }) => fetchMarketplacePopular({ limit: 20, offset: pageParam }),
    initialPageParam: 0,
  });
}

export function prefetchMarketplaceMcpFeed(queryClient: QueryClient): void {
  void queryClient.prefetchInfiniteQuery({
    queryKey: mcpMarketplaceKeys.feed("__popular__", "all"),
    queryFn: ({ pageParam }) => fetchMcpMarketplacePopular({ limit: 30, offset: pageParam }),
    initialPageParam: 0,
  });
}

export function prefetchMarketplaceCliFeed(queryClient: QueryClient): void {
  void queryClient.prefetchInfiniteQuery({
    queryKey: cliMarketplaceKeys.feed("__popular__"),
    queryFn: ({ pageParam }) => fetchCliMarketplacePopular({ limit: 30, offset: pageParam }),
    initialPageParam: 0,
  });
}
