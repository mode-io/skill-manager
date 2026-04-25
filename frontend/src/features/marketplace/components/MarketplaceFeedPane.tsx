import { useEffect, type ReactNode } from "react";

import { ErrorBanner } from "../../../components/ErrorBanner";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { useInfiniteScrollSentinel } from "../../../lib/query";

interface MarketplaceFeedPaneProps {
  isActive: boolean;
  status: "loading" | "ready" | "error";
  itemCount: number;
  hasMore: boolean;
  loadingMore: boolean;
  loadingLabel: string;
  loadingMoreLabel?: string;
  errorMessage: string;
  emptyState?: ReactNode;
  onItemCountChange: (count: number) => void;
  onLoadMore: () => Promise<unknown>;
  children: ReactNode;
}

export function MarketplaceFeedPane({
  isActive,
  status,
  itemCount,
  hasMore,
  loadingMore,
  loadingLabel,
  loadingMoreLabel = "Loading more",
  errorMessage,
  emptyState,
  onItemCountChange,
  onLoadMore,
  children,
}: MarketplaceFeedPaneProps) {
  const sentinelRef = useInfiniteScrollSentinel({
    enabled: status === "ready" && hasMore && isActive,
    hasMore,
    onLoadMore,
  });

  useEffect(() => {
    onItemCountChange(itemCount);
  }, [itemCount, onItemCountChange]);

  if (status === "loading" && itemCount === 0) {
    return (
      <div className="panel-state">
        <LoadingSpinner label={loadingLabel} />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="panel-state">
        <ErrorBanner message={errorMessage} />
      </div>
    );
  }

  if (status !== "ready") {
    return null;
  }

  if (itemCount === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <>
      {children}
      {hasMore ? <div ref={sentinelRef} aria-hidden="true" /> : null}
      {loadingMore ? (
        <div className="panel-state">
          <LoadingSpinner size="sm" label={loadingMoreLabel} />
        </div>
      ) : null}
    </>
  );
}
