import { act, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarketplaceFeedPane } from "./MarketplaceFeedPane";

const observers: MockIntersectionObserver[] = [];

class MockIntersectionObserver {
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    observers.push(this);
  }

  observe(): void {}
  disconnect(): void {}
  unobserve(): void {}

  trigger(isIntersecting = true): void {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

function renderPane(
  overrides: Partial<ComponentProps<typeof MarketplaceFeedPane>> = {},
) {
  const onItemCountChange = vi.fn();
  const onLoadMore = vi.fn(async () => undefined);
  const props: ComponentProps<typeof MarketplaceFeedPane> = {
    isActive: true,
    status: "ready",
    itemCount: 1,
    hasMore: false,
    loadingMore: false,
    loadingLabel: "Loading marketplace",
    errorMessage: "Unable to load marketplace",
    onItemCountChange,
    onLoadMore,
    children: <div>Marketplace item</div>,
    ...overrides,
  };

  const result = render(<MarketplaceFeedPane {...props} />);
  return { ...result, onItemCountChange, onLoadMore };
}

describe("MarketplaceFeedPane", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    observers.length = 0;
  });

  it("renders loading, error, and empty states", () => {
    const { rerender } = renderPane({ status: "loading", itemCount: 0 });
    expect(screen.getByRole("status", { name: "Loading marketplace" })).toBeInTheDocument();

    rerender(
      <MarketplaceFeedPane
        isActive
        status="error"
        itemCount={0}
        hasMore={false}
        loadingMore={false}
        loadingLabel="Loading marketplace"
        errorMessage="Backend unavailable"
        onItemCountChange={() => undefined}
        onLoadMore={async () => undefined}
      >
        <div>Marketplace item</div>
      </MarketplaceFeedPane>,
    );
    expect(screen.getByText("Backend unavailable")).toBeInTheDocument();

    rerender(
      <MarketplaceFeedPane
        isActive
        status="ready"
        itemCount={0}
        hasMore={false}
        loadingMore={false}
        loadingLabel="Loading marketplace"
        errorMessage="Backend unavailable"
        emptyState={<p>No marketplace items</p>}
        onItemCountChange={() => undefined}
        onLoadMore={async () => undefined}
      >
        <div>Marketplace item</div>
      </MarketplaceFeedPane>,
    );
    expect(screen.getByText("No marketplace items")).toBeInTheDocument();
    expect(screen.queryByText("Marketplace item")).not.toBeInTheDocument();
  });

  it("reports item counts and renders children for ready feeds", async () => {
    const { onItemCountChange, rerender } = renderPane({ itemCount: 2 });

    expect(screen.getByText("Marketplace item")).toBeInTheDocument();
    await waitFor(() => expect(onItemCountChange).toHaveBeenLastCalledWith(2));

    rerender(
      <MarketplaceFeedPane
        isActive
        status="ready"
        itemCount={4}
        hasMore={false}
        loadingMore={false}
        loadingLabel="Loading marketplace"
        errorMessage="Unable to load marketplace"
        onItemCountChange={onItemCountChange}
        onLoadMore={async () => undefined}
      >
        <div>Updated item</div>
      </MarketplaceFeedPane>,
    );

    expect(screen.getByText("Updated item")).toBeInTheDocument();
    await waitFor(() => expect(onItemCountChange).toHaveBeenLastCalledWith(4));
  });

  it("loads more when the active sentinel intersects", async () => {
    const onLoadMore = vi.fn(async () => undefined);
    renderPane({ hasMore: true, onLoadMore });

    await act(async () => {
      observers[0]?.trigger(true);
    });

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("does not load more when inactive and shows loading-more state", async () => {
    const onLoadMore = vi.fn(async () => undefined);
    renderPane({
      isActive: false,
      hasMore: true,
      loadingMore: true,
      loadingMoreLabel: "Loading another page",
      onLoadMore,
    });

    await act(async () => {
      observers[0]?.trigger(true);
    });

    expect(onLoadMore).not.toHaveBeenCalled();
    expect(screen.getByRole("status", { name: "Loading another page" })).toBeInTheDocument();
  });
});
