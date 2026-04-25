import { useEffect, useRef } from "react";

interface InfiniteScrollSentinelOptions {
  enabled: boolean;
  hasMore: boolean;
  onLoadMore: () => Promise<unknown>;
  rootMargin?: string;
}

export function useInfiniteScrollSentinel({
  enabled,
  hasMore,
  onLoadMore,
  rootMargin = "240px",
}: InfiniteScrollSentinelOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const pagingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !hasMore) {
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
        void onLoadMore().finally(() => {
          pagingRef.current = false;
        });
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, hasMore, onLoadMore, rootMargin]);

  return sentinelRef;
}
