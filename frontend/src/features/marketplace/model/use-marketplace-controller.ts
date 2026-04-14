import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { usePendingRegistry } from "../../../lib/async/pending-registry";
import {
  flattenMarketplaceItems,
  useInstallMarketplaceSkillMutation,
  useMarketplaceFeedQuery,
} from "../api/queries";
import type { MarketplaceItemDto } from "../api/types";
import { marketplaceInstallActionKey, marketplaceSearchActionKey } from "./pending";

export interface MarketplaceController {
  query: string;
  submittedQuery: string;
  errorMessage: string;
  selectedItemId: string | null;
  selectedItem: MarketplaceItemDto | null;
  items: MarketplaceItemDto[];
  feedQuery: ReturnType<typeof useMarketplaceFeedQuery>;
  mode: "popular" | "search";
  status: "loading" | "ready" | "error";
  hasMore: boolean;
  loadingMore: boolean;
  searchSubmitPending: boolean;
  resultLabel: string;
  setQuery: (value: string) => void;
  submitSearch: () => Promise<void>;
  openItem: (itemId: string) => void;
  closeItem: () => void;
  installItem: (item: Pick<MarketplaceItemDto, "id" | "installToken">) => Promise<void>;
  isInstallPending: (itemId: string) => boolean;
  openInstalledSkill: (skillRef: string) => void;
  dismissError: () => void;
}

export function useMarketplaceController(): MarketplaceController {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [pendingSearchActionKey, setPendingSearchActionKey] = useState<string | null>(null);
  const pendingRegistry = usePendingRegistry<string>();

  const feedQuery = useMarketplaceFeedQuery(submittedQuery);
  const installMutation = useInstallMarketplaceSkillMutation();
  const items = useMemo(() => flattenMarketplaceItems(feedQuery.data), [feedQuery.data]);
  const activeSearchActionKey = marketplaceSearchActionKey(submittedQuery);
  const mode = submittedQuery.trim() ? "search" : "popular";
  const status: "loading" | "ready" | "error" = feedQuery.isPending
    ? "loading"
    : feedQuery.error
      ? "error"
      : "ready";
  const selectedItemId = searchParams.get("item");
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  const resultLabel = useMemo(() => {
    if (mode === "popular") {
      return "All-time leaderboard";
    }
    return submittedQuery ? `Search results for “${submittedQuery}”` : "Search results";
  }, [mode, submittedQuery]);

  useEffect(() => {
    if (pendingSearchActionKey === null || activeSearchActionKey !== pendingSearchActionKey) {
      return;
    }
    if (feedQuery.fetchStatus === "idle") {
      pendingRegistry.finish(pendingSearchActionKey);
      setPendingSearchActionKey(null);
    }
  }, [activeSearchActionKey, feedQuery.fetchStatus, pendingRegistry, pendingSearchActionKey]);

  function updateSelectedItem(itemId: string | null, replace = false): void {
    const nextParams = new URLSearchParams(searchParams);
    if (itemId) {
      nextParams.set("item", itemId);
    } else {
      nextParams.delete("item");
    }
    setSearchParams(nextParams, { replace });
  }

  async function submitSearch(): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed) {
      if (!submittedQuery) {
        setErrorMessage("");
        return;
      }
      const nextSearchActionKey = marketplaceSearchActionKey("");
      pendingRegistry.begin(nextSearchActionKey);
      setPendingSearchActionKey(nextSearchActionKey);
      setSubmittedQuery("");
      setErrorMessage("");
      return;
    }
    if (trimmed.length < 2) {
      setErrorMessage("Enter at least 2 characters to search skills.sh.");
      return;
    }
    if (trimmed === submittedQuery) {
      setErrorMessage("");
      return;
    }
    const nextSearchActionKey = marketplaceSearchActionKey(trimmed);
    pendingRegistry.begin(nextSearchActionKey);
    setPendingSearchActionKey(nextSearchActionKey);
    setSubmittedQuery(trimmed);
    setErrorMessage("");
  }

  async function installItem(item: Pick<MarketplaceItemDto, "id" | "installToken">): Promise<void> {
    try {
      setErrorMessage("");
      await pendingRegistry.run(
        marketplaceInstallActionKey(item.id),
        () => installMutation.mutateAsync({ installToken: item.installToken }),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to install the skill.");
      throw error;
    }
  }

  function openInstalledSkill(skillRef: string): void {
    navigate(`/skills/managed?skill=${encodeURIComponent(skillRef)}`);
  }

  return {
    query,
    submittedQuery,
    errorMessage,
    selectedItemId,
    selectedItem,
    items,
    feedQuery,
    mode,
    status,
    hasMore: Boolean(feedQuery.hasNextPage),
    loadingMore: feedQuery.isFetchingNextPage,
    searchSubmitPending: pendingSearchActionKey !== null && pendingRegistry.isPending(pendingSearchActionKey),
    resultLabel,
    setQuery,
    submitSearch,
    openItem: (itemId) => {
      setErrorMessage("");
      updateSelectedItem(selectedItemId === itemId ? null : itemId);
    },
    closeItem: () => updateSelectedItem(null),
    installItem,
    isInstallPending: (itemId) => pendingRegistry.isPending(marketplaceInstallActionKey(itemId)),
    openInstalledSkill,
    dismissError: () => setErrorMessage(""),
  };
}
