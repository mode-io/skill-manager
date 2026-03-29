import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { MarketplaceCard } from "../components/MarketplaceCard";
import { SearchInput } from "../components/SearchInput";
import {
  flattenMarketplaceItems,
  useInstallMarketplaceSkillMutation,
  useMarketplaceFeedQuery,
} from "../features/marketplace/queries";

const ENRICHMENT_REFRESH_DELAY_MS = 1500;
const LOADING_SUMMARY = "Summary loading from skills.sh…";

export function MarketplacePage() {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const pagingRef = useRef(false);

  const feedQuery = useMarketplaceFeedQuery(submittedQuery);
  const installMutation = useInstallMarketplaceSkillMutation();
  const items = useMemo(() => flattenMarketplaceItems(feedQuery.data), [feedQuery.data]);
  const mode = submittedQuery.trim() ? "search" : "popular";
  const hasMore = Boolean(feedQuery.hasNextPage);
  const loadingMore = feedQuery.isFetchingNextPage;
  const status: "loading" | "ready" | "error" = feedQuery.isPending
    ? "loading"
    : feedQuery.error
      ? "error"
      : "ready";

  useEffect(() => {
    if (status !== "ready" || !hasMore) {
      return;
    }
    const node = sentinelRef.current;
    if (!node) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || pagingRef.current) {
          return;
        }
        pagingRef.current = true;
        void feedQuery.fetchNextPage().finally(() => {
          pagingRef.current = false;
        });
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [feedQuery.fetchNextPage, hasMore, status]);

  useEffect(() => {
    if (status !== "ready" || items.length === 0 || !items.some((item) => item.description === LOADING_SUMMARY)) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void feedQuery.refetch().catch(() => {
        // Keep the current cards stable if background enrichment refresh fails.
      });
    }, ENRICHMENT_REFRESH_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [feedQuery.refetch, items, status]);

  const resultLabel = useMemo(() => {
    if (mode === "popular") {
      return "All-time leaderboard";
    }
    return submittedQuery ? `Search results for “${submittedQuery}”` : "Search results";
  }, [mode, submittedQuery]);

  async function handleSearch(): Promise<void> {
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

  async function handleInstall(item: { id: string; installToken: string }): Promise<void> {
    try {
      setBusyId(item.id);
      await installMutation.mutateAsync({ installToken: item.installToken });
      navigate("/skills/managed");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to install the skill.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="marketplace-page">
      <div className="marketplace-page__hero">
        <div>
          <h2>Marketplace</h2>
          <p className="page-header__copy">
            Browse the all-time skills.sh leaderboard and install repo-backed skills into the managed store.
          </p>
        </div>
      </div>

      {errorMessage && <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage("")} />}

      <div className="marketplace-toolbar">
        <SearchInput
          value={query}
          onChange={setQuery}
          onSubmit={() => void handleSearch()}
          placeholder="Search skills.sh by skill name or topic"
          loading={feedQuery.isFetching && items.length > 0 && !loadingMore}
        />
      </div>

      <div className="marketplace-header">
        <div>
          <h3>{resultLabel}</h3>
          <p className="marketplace-header__note">
            {mode === "popular"
              ? "Ranked by all-time installs on skills.sh. GitHub stars are shown as repository context."
              : "Search results are still ordered by installs. Enter at least 2 characters to query skills.sh."}
          </p>
        </div>
      </div>

      {status === "loading" && items.length === 0 ? (
        <div className="panel-state">
          <LoadingSpinner label="Loading marketplace" />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="panel-state">
          <p>Unable to load the marketplace.</p>
        </div>
      ) : null}

      {status === "ready" ? (
        <>
          <div className="marketplace-grid">
            {items.map((item) => (
              <MarketplaceCard
                key={item.id}
                item={item}
                disabled={busyId !== null}
                installing={busyId === item.id}
                onInstall={() => void handleInstall(item)}
              />
            ))}
          </div>
          {hasMore ? <div ref={sentinelRef} className="marketplace-load-sentinel" aria-hidden="true" /> : null}
          {loadingMore ? (
            <div className="marketplace-load-more">
              <LoadingSpinner size="sm" label="Loading more marketplace skills" />
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
