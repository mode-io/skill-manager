import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  flattenMcpMarketplaceItems,
  useMcpMarketplaceFeedQuery,
} from "../api/mcp-queries";
import type {
  McpMarketplaceItemDto,
} from "../api/mcp-types";

export interface McpMarketplaceController {
  query: string;
  submittedQuery: string;
  items: McpMarketplaceItemDto[];
  feedQuery: ReturnType<typeof useMcpMarketplaceFeedQuery>;
  status: "loading" | "ready" | "error";
  errorMessage: string;
  hasMore: boolean;
  loadingMore: boolean;
  selectedName: string | null;
  selectedItem: McpMarketplaceItemDto | null;
  setQuery: (value: string) => void;
  openItem: (qualifiedName: string) => void;
  closeItem: () => void;
}

export interface McpMarketplaceControllerOptions {
  query?: string;
  onQueryChange?: (value: string) => void;
}

export function useMcpMarketplaceController(
  options: McpMarketplaceControllerOptions = {},
): McpMarketplaceController {
  const [searchParams, setSearchParams] = useSearchParams();
  const [internalQuery, setInternalQuery] = useState("");
  const query = options.query !== undefined ? options.query : internalQuery;
  const setQuery = options.onQueryChange ?? setInternalQuery;
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const feedQuery = useMcpMarketplaceFeedQuery(submittedQuery);
  const items = useMemo(() => flattenMcpMarketplaceItems(feedQuery.data), [feedQuery.data]);

  const status: "loading" | "ready" | "error" = feedQuery.isPending
    ? "loading"
    : feedQuery.error
      ? "error"
      : "ready";

  const selectedName = searchParams.get("item");
  const selectedItem = items.find((item) => item.qualifiedName === selectedName) ?? null;

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === submittedQuery) {
      return;
    }
    if (!trimmed) {
      setSubmittedQuery("");
      setErrorMessage("");
      return;
    }
    if (trimmed.length < 2) {
      return;
    }
    const handle = window.setTimeout(() => {
      setSubmittedQuery(trimmed);
      setErrorMessage("");
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, submittedQuery]);

  function updateParams(updates: Record<string, string | null>): void {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    setSearchParams(next, { replace: false });
  }

  return {
    query,
    submittedQuery,
    items,
    feedQuery,
    status,
    errorMessage,
    hasMore: Boolean(feedQuery.hasNextPage),
    loadingMore: feedQuery.isFetchingNextPage,
    selectedName,
    selectedItem,
    setQuery,
    openItem: (qualifiedName) => updateParams({ item: qualifiedName }),
    closeItem: () => updateParams({ item: null }),
  };
}
