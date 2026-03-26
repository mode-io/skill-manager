import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchMarketplacePopular, installSkill, searchMarketplace } from "../api/client";
import type { MarketplaceItem, MarketplacePageResult } from "../api/types";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { MarketplaceCard } from "../components/MarketplaceCard";
import { SearchInput } from "../components/SearchInput";

interface MarketplacePageProps {
  refreshToken: number;
  onDataChanged: () => void;
}

const PAGE_SIZE = 18;

export function MarketplacePage({ refreshToken, onDataChanged }: MarketplacePageProps): JSX.Element {
  const navigate = useNavigate();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [mode, setMode] = useState<"popular" | "search">("popular");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const pagingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadPage({ nextMode: "popular", nextQuery: "", offset: 0, append: false, cancelledRef: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  useEffect(() => {
    if (status !== "ready" || !hasMore || nextOffset === null) {
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
        void loadPage({
          nextMode: mode,
          nextQuery: submittedQuery,
          offset: nextOffset,
          append: true,
        });
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, mode, nextOffset, status, submittedQuery]);

  const resultLabel = useMemo(() => {
    if (mode === "popular") {
      return "Popular skills";
    }
    return submittedQuery ? `Search results for “${submittedQuery}”` : "Search results";
  }, [mode, submittedQuery]);

  async function handleSearch(): Promise<void> {
    const trimmed = query.trim();
    await loadPage({
      nextMode: trimmed ? "search" : "popular",
      nextQuery: trimmed,
      offset: 0,
      append: false,
    });
  }

  async function handleInstall(item: MarketplaceItem): Promise<void> {
    try {
      setBusyId(item.id);
      await installSkill(item.sourceKind, item.sourceLocator);
      onDataChanged();
      navigate("/");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to install the skill.");
    } finally {
      setBusyId(null);
    }
  }

  async function loadPage({
    nextMode,
    nextQuery,
    offset,
    append,
    cancelledRef,
  }: {
    nextMode: "popular" | "search";
    nextQuery: string;
    offset: number;
    append: boolean;
    cancelledRef?: () => boolean;
  }): Promise<void> {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setStatus("loading");
        setErrorMessage("");
      }

      const payload = nextMode === "popular"
        ? await fetchMarketplacePopular({ limit: PAGE_SIZE, offset })
        : await searchMarketplace(nextQuery, { limit: PAGE_SIZE, offset });

      if (cancelledRef?.()) {
        return;
      }

      setItems((current) => append ? mergeMarketplaceItems(current, payload) : payload.items);
      setNextOffset(payload.nextOffset);
      setHasMore(payload.hasMore);
      setMode(nextMode);
      setSubmittedQuery(nextQuery);
      setStatus("ready");
    } catch (error) {
      if (cancelledRef?.()) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Unable to load the marketplace.");
      setStatus("error");
    } finally {
      pagingRef.current = false;
      setLoadingMore(false);
    }
  }

  return (
    <section className="marketplace-page">
      <div className="marketplace-page__hero">
        <div>
          <h2>Marketplace</h2>
          <p className="page-header__copy">
            Browse popular skills across the selected registries and install them into the managed store.
          </p>
        </div>
      </div>

      {errorMessage && <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage("")} />}

      <div className="marketplace-toolbar">
        <SearchInput
          value={query}
          onChange={setQuery}
          onSubmit={() => void handleSearch()}
          placeholder="Search by skill name or topic"
          loading={status === "loading" && items.length > 0}
        />
      </div>

      <div className="marketplace-header">
        <div>
          <h3>{resultLabel}</h3>
          <p className="marketplace-header__note">
            {mode === "popular" ? "Browse high-signal skills sorted by repository momentum." : "Continue scrolling to load more matching skills."}
          </p>
        </div>
      </div>

      {status === "loading" && items.length === 0 ? (
        <div className="panel-state">
          <LoadingSpinner label="Loading marketplace" />
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

function mergeMarketplaceItems(current: MarketplaceItem[], payload: MarketplacePageResult): MarketplaceItem[] {
  const seen = new Set(current.map((item) => item.id));
  const appended = payload.items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
  return [...current, ...appended];
}
