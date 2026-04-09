import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarketplacePage } from "./MarketplacePage";

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

function renderPage(initialEntries: string[] = ["/marketplace"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
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

  it("opens the marketplace detail overlay and loads the item preview", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/marketplace/popular?limit=20&offset=0")) {
        return okJson({
          items: [baseItem("mode-switch", "Mode Switch", 128)],
          nextOffset: null,
          hasMore: false,
        });
      }
      if (url.includes("/api/marketplace/items/skillssh%3Amode-io%2Fskills%3Amode-switch/document")) {
        return okJson({
          status: "ready",
          documentMarkdown: "# Mode Switch",
        });
      }
      if (url.includes("/api/marketplace/items/skillssh%3Amode-io%2Fskills%3Amode-switch")) {
        return okJson({
          id: "skillssh:mode-io/skills:mode-switch",
          name: "Mode Switch",
          description: "Switch between supported skill execution modes.",
          installs: 128,
          stars: 512,
          repoLabel: "mode-io/skills",
          repoImageUrl: "https://avatars.githubusercontent.com/u/424242?v=4",
          sourceLinks: {
            repoLabel: "mode-io/skills",
            repoUrl: "https://github.com/mode-io/skills",
            folderUrl: "https://github.com/mode-io/skills/tree/main/skills/mode-switch",
            skillsDetailUrl: "https://skills.sh/mode-io/skills/mode-switch",
          },
          installation: {
            status: "installable",
            installedSkillRef: null,
          },
          installToken: "token-mode-switch",
        });
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();

    await waitFor(() => expect(screen.getByText("Mode Switch")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /open marketplace detail for mode switch/i }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Mode Switch" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Close marketplace preview" })).toBeInTheDocument();
    expect(screen.getAllByText("128 installs")).toHaveLength(2);
  });

  it("shows a staged preview while the full marketplace detail is still loading", async () => {
    const pendingDetail = deferred<ReturnType<typeof okJson>>();

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/marketplace/popular?limit=20&offset=0")) {
        return okJson({
          items: [baseItem("mode-switch", "Mode Switch", 128)],
          nextOffset: null,
          hasMore: false,
        });
      }
      if (url.includes("/api/marketplace/items/skillssh%3Amode-io%2Fskills%3Amode-switch/document")) {
        return okJson({
          status: "ready",
          documentMarkdown: "## Full Preview Loaded",
        });
      }
      if (url.includes("/api/marketplace/items/skillssh%3Amode-io%2Fskills%3Amode-switch")) {
        return pendingDetail.promise;
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();

    await waitFor(() => expect(screen.getByText("Mode Switch")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /open marketplace detail for mode switch/i }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Mode Switch" })).toBeInTheDocument());
    expect(screen.getByText("Loading Preview")).toBeInTheDocument();
    expect(screen.getAllByText("Mode Switch description")).toHaveLength(2);

    await act(async () => {
      pendingDetail.resolve(
        okJson({
          id: "skillssh:mode-io/skills:mode-switch",
          name: "Mode Switch",
          description: "Switch between supported skill execution modes.",
          installs: 128,
          stars: 512,
          repoLabel: "mode-io/skills",
          repoImageUrl: "https://avatars.githubusercontent.com/u/424242?v=4",
          sourceLinks: {
            repoLabel: "mode-io/skills",
            repoUrl: "https://github.com/mode-io/skills",
            folderUrl: "https://github.com/mode-io/skills/tree/main/skills/mode-switch",
            skillsDetailUrl: "https://skills.sh/mode-io/skills/mode-switch",
          },
          installation: {
            status: "installable",
            installedSkillRef: null,
          },
          installToken: "token-mode-switch",
        }),
      );
    });

    await waitFor(() => expect(screen.getByText("Full Preview Loaded")).toBeInTheDocument());
  });
});

function okJson(payload: object) {
  return {
    ok: true,
    json: async () => payload,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function baseItem(id: string, name: string, installs: number) {
  return {
    id: `skillssh:mode-io/skills:${id}`,
    name,
    description: `${name} description`,
    installs,
    stars: 512,
    repoLabel: "mode-io/skills",
    repoImageUrl: "https://avatars.githubusercontent.com/u/424242?v=4",
    githubFolderUrl: `https://github.com/mode-io/skills/tree/main/skills/${id}`,
    skillsDetailUrl: `https://skills.sh/mode-io/skills/${id}`,
    installToken: `token-${id}`,
    installation: {
      status: "installable",
      installedSkillRef: null,
    },
  };
}
