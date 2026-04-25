import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  flattenCliMarketplaceItems,
  useCliMarketplaceFeedQuery,
} from "../api/cli-queries";
import type { CliMarketplaceItemDto } from "../api/cli-types";

export interface CliMarketplaceController {
  submittedQuery: string;
  items: CliMarketplaceItemDto[];
  feedQuery: ReturnType<typeof useCliMarketplaceFeedQuery>;
  status: "loading" | "ready" | "error";
  errorMessage: string;
  hasMore: boolean;
  loadingMore: boolean;
  selectedId: string | null;
  selectedItem: CliMarketplaceItemDto | null;
  openItem: (itemId: string) => void;
  closeItem: () => void;
}

export interface CliMarketplaceControllerOptions {
  query?: string;
  onQueryChange?: (value: string) => void;
}

export function useCliMarketplaceController(
  options: CliMarketplaceControllerOptions = {},
): CliMarketplaceController {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = options.query ?? "";
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const feedQuery = useCliMarketplaceFeedQuery(submittedQuery);
  const items = useMemo(() => flattenCliMarketplaceItems(feedQuery.data), [feedQuery.data]);

  const status: "loading" | "ready" | "error" = feedQuery.isPending
    ? "loading"
    : feedQuery.error
      ? "error"
      : "ready";
  const selectedId = searchParams.get("item");
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

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
    submittedQuery,
    items,
    feedQuery,
    status,
    errorMessage,
    hasMore: Boolean(feedQuery.hasNextPage),
    loadingMore: feedQuery.isFetchingNextPage,
    selectedId,
    selectedItem,
    openItem: (itemId) => updateParams({ item: itemId }),
    closeItem: () => updateParams({ item: null }),
  };
}
