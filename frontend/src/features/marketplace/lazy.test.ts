import { describe, expect, it, vi } from "vitest";

import {
  prefetchMarketplaceCliFeed,
  prefetchMarketplaceMcpFeed,
  prefetchMarketplacePopularFeed,
} from "./lazy";

function queryClientStub() {
  return {
    prefetchInfiniteQuery: vi.fn(),
  };
}

describe("marketplace feed prefetching", () => {
  it("passes infinite pagination options when prefetching skills", () => {
    const queryClient = queryClientStub();

    prefetchMarketplacePopularFeed(queryClient as never);

    const options = queryClient.prefetchInfiniteQuery.mock.calls[0]?.[0];
    expect(options.getNextPageParam({ hasMore: true, nextOffset: 20 })).toBe(20);
    expect(options.getNextPageParam({ hasMore: false, nextOffset: 40 })).toBeUndefined();
  });

  it("passes infinite pagination options when prefetching MCP servers", () => {
    const queryClient = queryClientStub();

    prefetchMarketplaceMcpFeed(queryClient as never);

    const options = queryClient.prefetchInfiniteQuery.mock.calls[0]?.[0];
    expect(options.getNextPageParam({ hasMore: true, nextOffset: 30 })).toBe(30);
    expect(options.getNextPageParam({ hasMore: false, nextOffset: 60 })).toBeUndefined();
  });

  it("passes infinite pagination options when prefetching CLIs", () => {
    const queryClient = queryClientStub();

    prefetchMarketplaceCliFeed(queryClient as never);

    const options = queryClient.prefetchInfiniteQuery.mock.calls[0]?.[0];
    expect(options.getNextPageParam({ hasMore: true, nextOffset: 30 })).toBe(30);
    expect(options.getNextPageParam({ hasMore: false, nextOffset: 60 })).toBeUndefined();
  });
});
