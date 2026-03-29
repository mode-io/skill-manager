import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarketplacePage } from "../pages/MarketplacePage";

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

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MarketplacePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MarketplacePage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    observers.length = 0;
  });

  it("appends additional leaderboard results when the scroll sentinel intersects", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/marketplace/popular?limit=20&offset=0")) {
        return okJson({
          items: [
            baseItem("skill-1", "Skill One", 128),
            baseItem("skill-2", "Skill Two", 96),
          ],
          nextOffset: 2,
          hasMore: true,
        });
      }
      if (url.includes("/api/marketplace/popular?limit=20&offset=2")) {
        return okJson({
          items: [baseItem("skill-3", "Skill Three", 72)],
          nextOffset: null,
          hasMore: false,
        });
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

  it("replaces the result set when a new search is submitted", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/marketplace/popular?limit=20&offset=0")) {
        return okJson({
          items: [baseItem("skill-1", "Skill One", 128)],
          nextOffset: null,
          hasMore: false,
        });
      }
      if (url.includes("/api/marketplace/search") && url.includes("q=trace") && url.includes("limit=20") && url.includes("offset=0")) {
        return okJson({
          items: [baseItem("trace-skill", "Trace Skill", 41)],
          nextOffset: null,
          hasMore: false,
        });
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();

    await waitFor(() => expect(screen.getByText("Skill One")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("Search skills.sh by skill name or topic"), {
      target: { value: "trace" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("Trace Skill")).toBeInTheDocument());
    expect(screen.queryByText("Skill One")).not.toBeInTheDocument();
  });

  it("returns to the leaderboard when the query is cleared and search is submitted", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/marketplace/popular?limit=20&offset=0")) {
        return okJson({
          items: [baseItem("skill-1", "Skill One", 128)],
          nextOffset: null,
          hasMore: false,
        });
      }
      if (url.includes("/api/marketplace/search") && url.includes("q=trace") && url.includes("limit=20") && url.includes("offset=0")) {
        return okJson({
          items: [baseItem("trace-skill", "Trace Skill", 41)],
          nextOffset: null,
          hasMore: false,
        });
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Skill One")).toBeInTheDocument());

    const input = screen.getByPlaceholderText("Search skills.sh by skill name or topic");
    fireEvent.change(input, { target: { value: "trace" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(screen.getByText("Trace Skill")).toBeInTheDocument());

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("All-time leaderboard")).toBeInTheDocument());
    expect(screen.getByText("Skill One")).toBeInTheDocument();
    expect(screen.queryByText("Trace Skill")).not.toBeInTheDocument();
  });

  it("refreshes visible cards when summaries finish loading in the background", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/marketplace/popular?limit=20&offset=0")) {
        const callCount = fetchMock.mock.calls.length;
        return okJson({
          items: [
            {
              ...baseItem("skill-1", "Skill One", 128),
              description: callCount === 1 ? "Summary loading from skills.sh…" : "Enriched summary from skills.sh.",
            },
          ],
          nextOffset: null,
          hasMore: false,
        });
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();

    await waitFor(() => expect(screen.getByText("Summary loading from skills.sh…")).toBeInTheDocument());

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1700));
    });

    await waitFor(() => expect(screen.getByText("Enriched summary from skills.sh.")).toBeInTheDocument());
  });
});

function okJson(payload: object) {
  return {
    ok: true,
    json: async () => payload,
  };
}

function baseItem(id: string, name: string, installs: number) {
  return {
    id,
    name,
    description: `${name} description`,
    installs,
    stars: 512,
    repoLabel: "mode-io/skills",
    repoImageUrl: "https://avatars.githubusercontent.com/u/424242?v=4",
    githubFolderUrl: `https://github.com/mode-io/skills/tree/main/skills/${id}`,
    skillsDetailUrl: `https://skills.sh/mode-io/skills/${id}`,
    installToken: `token-${id}`,
  };
}
