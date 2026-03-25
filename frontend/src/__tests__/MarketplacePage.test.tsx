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
  return render(
    <MemoryRouter>
      <MarketplacePage refreshToken={0} onDataChanged={() => {}} />
    </MemoryRouter>,
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

  it("appends additional marketplace results when the scroll sentinel intersects", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/marketplace/popular?limit=18&offset=0")) {
        return okJson({
          items: [
            baseItem("skill-1", "Skill One"),
            baseItem("skill-2", "Skill Two"),
          ],
          nextOffset: 2,
          hasMore: true,
        });
      }
      if (url.includes("/marketplace/popular?limit=18&offset=2")) {
        return okJson({
          items: [baseItem("skill-3", "Skill Three")],
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
      if (url.includes("/marketplace/popular?limit=18&offset=0")) {
        return okJson({
          items: [baseItem("skill-1", "Skill One")],
          nextOffset: null,
          hasMore: false,
        });
      }
      if (url.includes("/marketplace/search") && url.includes("q=trace") && url.includes("limit=18") && url.includes("offset=0")) {
        return okJson({
          items: [baseItem("trace-skill", "Trace Skill")],
          nextOffset: null,
          hasMore: false,
        });
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();

    await waitFor(() => expect(screen.getByText("Skill One")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("Search by skill name or topic"), {
      target: { value: "trace" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("Trace Skill")).toBeInTheDocument());
    expect(screen.queryByText("Skill One")).not.toBeInTheDocument();
  });
});

function okJson(payload: object) {
  return {
    ok: true,
    json: async () => payload,
  };
}

function baseItem(id: string, name: string) {
  return {
    id,
    name,
    description: `${name} description`,
    descriptionStatus: "resolved",
    sourceKind: "github",
    sourceLocator: `github:mode-io/skills/${id}`,
    registry: "skillssh",
    github: {
      repo: "mode-io/skills",
      url: "https://github.com/mode-io/skills",
      ownerLogin: "mode-io",
      avatarPath: "/marketplace/avatar?repo=mode-io%2Fskills",
      stars: 512,
    },
  };
}
