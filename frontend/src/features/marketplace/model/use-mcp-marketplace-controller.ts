import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  flattenMcpMarketplaceItems,
  useMcpMarketplaceFeedQuery,
} from "../api/mcp-queries";
import type {
  McpMarketplaceFilter,
  McpMarketplaceItemDto,
} from "../api/mcp-types";

const FILTER_VALUES: readonly McpMarketplaceFilter[] = [
  "all",
  "remote",
  "local",
  "verified",
];

function isFilterValue(value: string): value is McpMarketplaceFilter {
  return (FILTER_VALUES as readonly string[]).includes(value);
}

export interface McpMarketplaceController {
  query: string;
  submittedQuery: string;
  filter: McpMarketplaceFilter;
  items: McpMarketplaceItemDto[];
  feedQuery: ReturnType<typeof useMcpMarketplaceFeedQuery>;
  status: "loading" | "ready" | "error";
  errorMessage: string;
  hasMore: boolean;
  loadingMore: boolean;
  selectedName: string | null;
  selectedItem: McpMarketplaceItemDto | null;
  setQuery: (value: string) => void;
  setFilter: (value: McpMarketplaceFilter) => void;
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

  const filterParam = searchParams.get("filter") ?? "all";
  const filter: McpMarketplaceFilter = isFilterValue(filterParam) ? filterParam : "all";

  const feedQuery = useMcpMarketplaceFeedQuery(submittedQuery, filter);
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

  function setFilter(value: McpMarketplaceFilter): void {
    if (value === filter) {
      return;
    }
    if (value === "all") {
      updateParams({ filter: null });
    } else {
      updateParams({ filter: value });
    }
  }

  return {
    query,
    submittedQuery,
    filter,
    items,
    feedQuery,
    status,
    errorMessage,
    hasMore: Boolean(feedQuery.hasNextPage),
    loadingMore: feedQuery.isFetchingNextPage,
    selectedName,
    selectedItem,
    setQuery,
    setFilter,
    openItem: (qualifiedName) => updateParams({ item: qualifiedName }),
    closeItem: () => updateParams({ item: null }),
  };
}
