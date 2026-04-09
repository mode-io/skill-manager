import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  flattenMarketplaceItems,
  useInstallMarketplaceSkillMutation,
  useMarketplaceFeedQuery,
} from "../api/queries";
import type { MarketplaceItemDto } from "../api/types";

const LOADING_SUMMARY = "Summary loading from skills.sh…";

export interface MarketplaceController {
  query: string;
  submittedQuery: string;
  errorMessage: string;
  busyInstallItemId: string | null;
  selectedItemId: string | null;
  selectedItem: MarketplaceItemDto | null;
  items: MarketplaceItemDto[];
  feedQuery: ReturnType<typeof useMarketplaceFeedQuery>;
  mode: "popular" | "search";
  status: "loading" | "ready" | "error";
  hasMore: boolean;
  loadingMore: boolean;
  resultLabel: string;
  setQuery: (value: string) => void;
  submitSearch: () => Promise<void>;
  openItem: (itemId: string) => void;
  closeItem: () => void;
  installItem: (item: Pick<MarketplaceItemDto, "id" | "installToken">) => Promise<void>;
  openInstalledSkill: (skillRef: string) => void;
  dismissError: () => void;
  hasLoadingSummaries: boolean;
}

export function useMarketplaceController(): MarketplaceController {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [busyInstallItemId, setBusyInstallItemId] = useState<string | null>(null);

  const feedQuery = useMarketplaceFeedQuery(submittedQuery);
  const installMutation = useInstallMarketplaceSkillMutation();
  const items = useMemo(() => flattenMarketplaceItems(feedQuery.data), [feedQuery.data]);
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
      setSubmittedQuery("");
      setErrorMessage("");
      return;
    }
    if (trimmed.length < 2) {
      setErrorMessage("Enter at least 2 characters to search skills.sh.");
      return;
    }
    setSubmittedQuery(trimmed);
    setErrorMessage("");
  }

  async function installItem(item: Pick<MarketplaceItemDto, "id" | "installToken">): Promise<void> {
    try {
      setBusyInstallItemId(item.id);
      setErrorMessage("");
      await installMutation.mutateAsync({ installToken: item.installToken });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to install the skill.");
      throw error;
    } finally {
      setBusyInstallItemId(null);
    }
  }

  function openInstalledSkill(skillRef: string): void {
    navigate(`/skills/managed?skill=${encodeURIComponent(skillRef)}`);
  }

  return {
    query,
    submittedQuery,
    errorMessage,
    busyInstallItemId,
    selectedItemId,
    selectedItem,
    items,
    feedQuery,
    mode,
    status,
    hasMore: Boolean(feedQuery.hasNextPage),
    loadingMore: feedQuery.isFetchingNextPage,
    resultLabel,
    setQuery,
    submitSearch,
    openItem: (itemId) => {
      setErrorMessage("");
      updateSelectedItem(selectedItemId === itemId ? null : itemId);
    },
    closeItem: () => updateSelectedItem(null),
    installItem,
    openInstalledSkill,
    dismissError: () => setErrorMessage(""),
    hasLoadingSummaries: items.some((item) => item.description === LOADING_SUMMARY),
  };
}
