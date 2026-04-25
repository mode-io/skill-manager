import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { okJson } from "../../../test/fetch";
import { marketplacePage } from "../../../test/fixtures/marketplace";
import { renderWithAppProviders } from "../../../test/render";
import { searchCliMarketplace } from "../api/cli-client";
import type { CliMarketplaceDetailDto, CliMarketplaceItemDto } from "../api/cli-types";
import MarketplaceCliPage from "./MarketplaceCliPage";

const fetchMock = vi.fn();

function cliItem(overrides: Partial<CliMarketplaceItemDto> = {}): CliMarketplaceItemDto {
  return {
    id: "clisdev:ollama",
    slug: "ollama",
    name: "Ollama",
    description: "Run local models.",
    marketplaceUrl: "https://clis.dev/cli/ollama",
    iconUrl: "https://github.com/ollama.png?size=96",
    githubUrl: "https://github.com/ollama/ollama",
    websiteUrl: "https://ollama.com",
    stars: 120000,
    language: "Go",
    category: "AI",
    hasMcp: true,
    hasSkill: false,
    isOfficial: true,
    isTui: true,
    sourceType: "official",
    vendorName: "Ollama",
    ...overrides,
  };
}

function cliDetail(overrides: Partial<CliMarketplaceDetailDto> = {}): CliMarketplaceDetailDto {
  return {
    ...cliItem(overrides),
    longDescription: "Run and manage local language models.\n\n## What It Enables\n\n- Pull models\n- Run `ollama serve`",
    installCommand: "brew install ollama",
    ...overrides,
  };
}

function renderPage({
  query = "",
  onItemCountChange = () => undefined,
}: {
  query?: string;
  onItemCountChange?: (count: number) => void;
} = {}) {
  return renderWithAppProviders(
    <MarketplaceCliPage
      isActive
      query={query}
      onQueryChange={() => undefined}
      onItemCountChange={onItemCountChange}
    />,
    { route: "/marketplace/clis" },
  );
}

describe("MarketplaceCliPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    fetchMock.mockReset();
  });

  it("loads CLI cards, reports count, and opens a preview detail sheet", async () => {
    const onItemCountChange = vi.fn();
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/marketplace/clis/popular?limit=30&offset=0")) {
        return okJson(marketplacePage([cliItem()]));
      }
      if (url.includes("/api/marketplace/clis/items/ollama")) {
        return okJson(cliDetail());
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage({ onItemCountChange });

    await waitFor(() => expect(screen.getByText("Ollama")).toBeInTheDocument());
    await waitFor(() => expect(onItemCountChange).toHaveBeenLastCalledWith(1));
    expect(screen.getByRole("img", { name: "Avatar for Ollama" })).toHaveAttribute(
      "src",
      "https://github.com/ollama.png?size=96",
    );

    fireEvent.click(screen.getByRole("button", { name: /open cli marketplace detail for ollama/i }));

    const sourceRail = await screen.findByLabelText("Source links for Ollama");
    const aboutHeading = screen.getByRole("heading", { name: "About" });
    const installHeading = screen.getByRole("heading", { name: "Install command preview" });

    expect(installHeading.compareDocumentPosition(aboutHeading) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(within(sourceRail).getByRole("link", { name: /repo/i })).toHaveAttribute(
      "href",
      "https://github.com/ollama/ollama",
    );
    expect(within(sourceRail).getByRole("link", { name: /website/i })).toHaveAttribute(
      "href",
      "https://ollama.com",
    );
    expect(within(sourceRail).queryByRole("link", { name: /clis.dev/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open ollama on clis\.dev/i }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "References" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Links" })).not.toBeInTheDocument();
    expect(document.querySelector(".detail-source-row")).toBeInTheDocument();
    expect(document.querySelector(`.${"detail"}-reference-links`)).not.toBeInTheDocument();
    expect(document.querySelector(".cli-detail__facts .chip")).not.toBeInTheDocument();
    expect(screen.getByLabelText("CLI facts for Ollama")).toHaveTextContent(
      /AI\s*·\s*Go\s*·\s*Official\s*·\s*TUI\s*·\s*MCP\s*·\s*120\.0k stars/,
    );
    expect(document.querySelector(".cli-detail__title-avatar img")).toHaveAttribute(
      "src",
      "https://github.com/ollama.png?size=96",
    );
    expect(await screen.findByRole("heading", { name: "What It Enables" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("ollama serve")).toBeInTheDocument();
    expect(screen.queryByText(/## What It Enables/)).not.toBeInTheDocument();
    expect(screen.getByText("brew install ollama")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Install command preview" }).parentElement)
      .not.toHaveTextContent(/Skill Manager does not install or manage CLIs/);
    expect(screen.queryByRole("button", { name: /install/i })).not.toBeInTheDocument();
  });

  it("omits CLIs.dev from source links when repo or website links exist", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/marketplace/clis/popular?limit=30&offset=0")) {
        return okJson(
          marketplacePage([
            cliItem({ githubUrl: null, iconUrl: null, websiteUrl: "https://example.com" }),
          ]),
        );
      }
      if (url.includes("/api/marketplace/clis/items/ollama")) {
        return okJson(cliDetail({ githubUrl: null, iconUrl: null, websiteUrl: "https://example.com" }));
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /open cli marketplace detail for ollama/i }))
        .toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /open cli marketplace detail for ollama/i }));

    const sourceRail = await screen.findByLabelText("Source links for Ollama");
    expect(within(sourceRail).getByRole("link", { name: /website/i })).toBeInTheDocument();
    expect(within(sourceRail).queryByRole("link", { name: /clis.dev/i })).not.toBeInTheDocument();
    expect(within(sourceRail).queryByRole("link", { name: /repo/i })).not.toBeInTheDocument();
  });

  it("uses CLIs.dev as the fallback source link when no repo or website is available", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/marketplace/clis/popular?limit=30&offset=0")) {
        return okJson(
          marketplacePage([
            cliItem({ githubUrl: null, iconUrl: null, websiteUrl: null }),
          ]),
        );
      }
      if (url.includes("/api/marketplace/clis/items/ollama")) {
        return okJson(cliDetail({ githubUrl: null, iconUrl: null, websiteUrl: null }));
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /open cli marketplace detail for ollama/i }))
        .toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /open cli marketplace detail for ollama/i }));

    const sourceRail = await screen.findByLabelText("Source links for Ollama");
    expect(within(sourceRail).getByRole("link", { name: /clis.dev/i })).toHaveAttribute(
      "href",
      "https://clis.dev/cli/ollama",
    );
  });

  it("searches through the CLI marketplace search endpoint", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/marketplace/clis/search?q=git&limit=30&offset=0") {
        return okJson(
          marketplacePage([
            cliItem({ id: "clisdev:lazygit", slug: "lazygit", name: "lazygit" }),
          ]),
        );
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    const payload = await searchCliMarketplace({ query: "git", limit: 30, offset: 0 });

    expect(payload.items[0].slug).toBe("lazygit");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/marketplace/clis/search?q=git&limit=30&offset=0",
    );
  });
});
