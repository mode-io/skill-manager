import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorJson, okJson } from "../../../test/fetch";
import { marketplacePage } from "../../../test/fixtures/marketplace";
import { renderWithAppProviders } from "../../../test/render";
import { createMarketplaceDetail, createMarketplaceItem } from "../test-fixtures";
import MarketplacePage from "./MarketplacePage";

const fetchMock = vi.fn();
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

function renderPage(route = "/marketplace/skills") {
  return renderWithAppProviders(
    <MarketplacePage
      isActive
      query=""
      onQueryChange={() => {}}
      onItemCountChange={() => {}}
    />,
    { route },
  );
}

describe("MarketplacePage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    fetchMock.mockReset();
    observers.length = 0;
  });

  it("appends additional leaderboard results when the scroll sentinel intersects", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/marketplace/popular?limit=20&offset=0")) {
        return okJson(
          marketplacePage(
            [
            baseItem("skill-1", "Skill One", 128),
            baseItem("skill-2", "Skill Two", 96),
            ],
            { nextOffset: 2, hasMore: true },
          ),
        );
      }
      if (url.includes("/api/marketplace/popular?limit=20&offset=2")) {
        return okJson(marketplacePage([baseItem("skill-3", "Skill Three", 72)]));
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();

    await waitFor(() => expect(screen.getByText("Skill One")).toBeInTheDocument());

    await act(async () => {
      observers[0]?.trigger(true);
    });

    await waitFor(() => expect(screen.getByText("Skill Three")).toBeInTheDocument());
  });

  it("opens the marketplace detail overlay and loads the item preview", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/marketplace/popular?limit=20&offset=0")) {
        return okJson(marketplacePage([baseItem("mode-switch", "Mode Switch", 128)]));
      }
      if (url.includes("/api/marketplace/items/skillssh%3Amode-io%2Fskills%3Amode-switch/document")) {
        return okJson({
          status: "ready",
          documentMarkdown: "# Mode Switch",
        });
      }
      if (url.includes("/api/marketplace/items/skillssh%3Amode-io%2Fskills%3Amode-switch")) {
        return okJson(
          createMarketplaceDetail({
            sourceLinks: {
              repoLabel: "mode-io/skills",
              repoUrl: "https://github.com/mode-io/skills",
              folderUrl: "https://github.com/mode-io/skills/tree/main/skills/mode-switch",
              skillsDetailUrl: "https://skills.sh/mode-io/skills/mode-switch",
            },
          }),
        );
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();

    await waitFor(() => expect(screen.getByText("Mode Switch")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /open marketplace detail for mode switch/i }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Mode Switch" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Close marketplace preview" })).toBeInTheDocument();
  });

  it("surfaces the backend marketplace error message", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/marketplace/popular?limit=20&offset=0")) {
        return errorJson(
          "Marketplace is temporarily unavailable. Check your network connection or reinstall skill-manager if the problem persists.",
          { status: 503, statusText: "Service Unavailable", field: "error" },
        );
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(
          "Marketplace is temporarily unavailable. Check your network connection or reinstall skill-manager if the problem persists.",
        ),
      ).toBeInTheDocument();
    });
  });
});

function baseItem(id: string, name: string, installs: number) {
  return createMarketplaceItem({
    id: `skillssh:mode-io/skills:${id}`,
    name,
    description: `${name} description`,
    installs,
    installToken: `token-${id}`,
  });
}
