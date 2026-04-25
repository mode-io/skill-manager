import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../../../components/Toast";
import { flattenUniquePageItems, queryPolicy } from "../../../lib/query";
import { invalidateMcpQueries } from "../../mcp/public";
import { useInstallingState } from "../model/installing-context";
import {
  fetchMcpInstallTargets,
  fetchMcpMarketplaceDetail,
  fetchMcpMarketplacePopular,
  addMcpServer,
  searchMcpMarketplace,
} from "./mcp-client";
import type {
  AddMcpServerResponseDto,
  McpMarketplaceFilter,
  McpMarketplaceItemDto,
  McpMarketplacePageResultDto,
} from "./mcp-types";

const MCP_MARKETPLACE_STALE_TIME_MS = 60_000;
const MCP_MARKETPLACE_GC_TIME_MS = 15 * 60_000;
const PAGE_SIZE = 30;

export const mcpMarketplaceKeys = {
  all: ["marketplace", "mcp"] as const,
  feed: (query: string, filter: McpMarketplaceFilter) =>
    ["marketplace", "mcp", "feed", query, filter] as const,
  detail: (qualifiedName: string) =>
    ["marketplace", "mcp", "detail", qualifiedName] as const,
  installTargets: () => ["marketplace", "mcp", "install-targets"] as const,
};

export function useMcpMarketplaceFeedQuery(query: string, filter: McpMarketplaceFilter) {
  const trimmed = query.trim();
  const usePopular = !trimmed && filter === "all";

  return useInfiniteQuery({
    queryKey: mcpMarketplaceKeys.feed(trimmed || "__popular__", filter),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      usePopular
        ? fetchMcpMarketplacePopular({ limit: PAGE_SIZE, offset: pageParam })
        : searchMcpMarketplace({
            query: trimmed,
            filter,
            limit: PAGE_SIZE,
            offset: pageParam,
          }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextOffset ?? undefined : undefined,
    ...queryPolicy(MCP_MARKETPLACE_STALE_TIME_MS, MCP_MARKETPLACE_GC_TIME_MS),
  });
}

export function useMcpMarketplaceDetailQuery(qualifiedName: string | null) {
  return useQuery({
    queryKey: mcpMarketplaceKeys.detail(qualifiedName ?? "__none__"),
    queryFn: () => fetchMcpMarketplaceDetail(qualifiedName!),
    enabled: Boolean(qualifiedName),
    ...queryPolicy(MCP_MARKETPLACE_STALE_TIME_MS, MCP_MARKETPLACE_GC_TIME_MS),
  });
}

export function useMcpInstallTargetsQuery() {
  return useQuery({
    queryKey: mcpMarketplaceKeys.installTargets(),
    queryFn: fetchMcpInstallTargets,
    ...queryPolicy(MCP_MARKETPLACE_GC_TIME_MS, MCP_MARKETPLACE_GC_TIME_MS),
  });
}

/**
 * Shared marketplace install mutation used by the detail view.
 * Handles: pending-state publication, inventory invalidation, and success/error toasts.
 */
export function useAddMcpServerMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { begin, finish } = useInstallingState();

  return useMutation<
    AddMcpServerResponseDto,
    Error,
    { qualifiedName: string; sourceHarness: string; displayName?: string }
  >({
    mutationFn: ({ qualifiedName, sourceHarness }) => addMcpServer({ qualifiedName, sourceHarness }),
    onMutate: ({ qualifiedName }) => {
      begin(qualifiedName);
    },
    onSuccess: (response, { displayName }) => {
      // Invalidate the central inventory so the card button flips to
      // "Open in MCPs" in place. User stays on the marketplace.
      void invalidateMcpQueries(queryClient);
      toast(`${displayName ?? response.server.name} added to your MCP servers`);
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : "Install failed");
    },
    onSettled: (_data, _err, { qualifiedName }) => {
      finish(qualifiedName);
    },
  });
}

export function flattenMcpMarketplaceItems(
  data: { pages: McpMarketplacePageResultDto[] } | undefined,
): McpMarketplaceItemDto[] {
  return flattenUniquePageItems(data, (item) => item.qualifiedName);
}
