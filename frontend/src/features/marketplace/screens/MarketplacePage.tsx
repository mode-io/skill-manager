import { useEffect, useRef } from "react";

import { ErrorBanner } from "../../../components/ErrorBanner";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { SearchInput } from "../../../components/SearchInput";
import { MarketplaceCard } from "../components/MarketplaceCard";
import { MarketplaceDetailSheet } from "../components/MarketplaceDetailSheet";
import { useMarketplaceController } from "../model/use-marketplace-controller";

const ENRICHMENT_REFRESH_DELAY_MS = 1500;

export function MarketplacePage() {
  const {
    query,
    errorMessage,
    busyInstallItemId,
    selectedItemId,
    selectedItem,
    items,
    feedQuery,
    mode,
    status,
    hasMore,
    loadingMore,
    resultLabel,
    setQuery,
    submitSearch,
    openItem,
    closeItem,
    installItem,
    openInstalledSkill,
    dismissError,
    hasLoadingSummaries,
  } = useMarketplaceController();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const pagingRef = useRef(false);

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
  }, [feedQuery, hasMore, status]);

  useEffect(() => {
    if (status !== "ready" || items.length === 0 || !hasLoadingSummaries) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void feedQuery.refetch().catch(() => {
        // Keep the current cards stable if background enrichment refresh fails.
      });
    }, ENRICHMENT_REFRESH_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [feedQuery, hasLoadingSummaries, items.length, status]);

  return (
    <>
      <section className="marketplace-page">
        <div className="marketplace-page__hero">
          <div>
            <h2>Marketplace</h2>
            <p className="page-header__copy">
              Browse the all-time skills.sh leaderboard and preview repo-backed skills before installing them into the managed store.
            </p>
          </div>
        </div>

        {errorMessage && !selectedItemId ? <ErrorBanner message={errorMessage} onDismiss={dismissError} /> : null}

        <div className="marketplace-toolbar">
          <SearchInput
            value={query}
            onChange={setQuery}
            onSubmit={() => void submitSearch()}
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
                  selected={item.id === selectedItemId}
                  installing={busyInstallItemId === item.id}
                  onOpenDetail={() => openItem(item.id)}
                  onInstall={() => void installItem(item)}
                  onOpenInstalledSkill={openInstalledSkill}
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

      <MarketplaceDetailSheet
        itemId={selectedItemId}
        initialItem={selectedItem}
        busyInstallItemId={busyInstallItemId}
        actionErrorMessage={selectedItemId ? errorMessage : ""}
        onDismissActionError={dismissError}
        onClose={closeItem}
        onInstall={installItem}
        onOpenInstalledSkill={openInstalledSkill}
      />
    </>
  );
}
