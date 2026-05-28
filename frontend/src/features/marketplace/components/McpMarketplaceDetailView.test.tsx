import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UiTooltipProvider } from "../../../components/ui/UiTooltipProvider";
import type { McpMarketplaceDetailDto, McpMarketplaceItemDto } from "../api/mcp-types";
import { McpMarketplaceDetailView } from "./McpMarketplaceDetailView";

const fetchMock = vi.fn();

function okJson(payload: object) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => payload,
  };
}

function controlledPromise<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function itemFixture(overrides: Partial<McpMarketplaceItemDto> = {}): McpMarketplaceItemDto {
  return {
    qualifiedName: "exa",
    namespace: "exa",
    displayName: "Exa Search",
    description: "Fast search.",
    iconUrl: null,
    isVerified: true,
    isRemote: true,
    isDeployed: true,
    useCount: 59087,
    createdAt: null,
    homepage: "https://exa.ai",
    externalUrl: "https://registry.modelcontextprotocol.io/?q=exa",
    githubUrl: "https://github.com/exa-labs/exa-mcp-server",
    websiteUrl: "https://exa.ai",
    ...overrides,
  };
}

function detailFixture(overrides: Partial<McpMarketplaceDetailDto> = {}): McpMarketplaceDetailDto {
  return {
    qualifiedName: "exa",
    managedName: "exa",
    displayName: "Exa Search",
    description: "Fast search.",
    iconUrl: null,
    isRemote: true,
    deploymentUrl: "https://mcp.exa.ai",
    connections: [],
    tools: [],
    resources: [],
    prompts: [],
    capabilityCounts: { tools: 0, resources: 0, prompts: 0 },
    externalUrl: "https://registry.modelcontextprotocol.io/?q=exa",
    githubUrl: "https://github.com/exa-labs/exa-mcp-server",
    websiteUrl: "https://exa.ai",
    ...overrides,
  };
}

function renderView(initialItem: McpMarketplaceItemDto | null = itemFixture()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UiTooltipProvider delayDuration={0} skipDelayDuration={0}>
        <MemoryRouter>
          <McpMarketplaceDetailView
            qualifiedName="exa"
            initialItem={initialItem}
            onClose={() => undefined}
          />
        </MemoryRouter>
      </UiTooltipProvider>
    </QueryClientProvider>,
  );
}

describe("McpMarketplaceDetailView", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("transitions from loading to loaded without changing hook order", async () => {
    const detail = controlledPromise<ReturnType<typeof okJson>>();
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/marketplace/mcp/items/exa")) {
        return detail.promise;
      }
      if (url.includes("/api/mcp/servers")) {
        return okJson({ columns: [], entries: [], issues: [] });
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderView();

    expect(screen.getByRole("status", { name: "Loading MCP details" })).toBeInTheDocument();

    await act(async () => {
      detail.resolve(okJson(detailFixture()));
    });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Exa Search" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /install exa search/i })).toBeEnabled();
    expect(screen.getByLabelText("Source links for Exa Search")).toBeInTheDocument();
    expect(screen.queryByText("Remote")).not.toBeInTheDocument();
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
    expect(screen.queryByText("59.1k")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View in MCP Registry" })).toHaveAttribute(
      "href",
      "https://registry.modelcontextprotocol.io/?q=exa",
    );
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/exa-labs/exa-mcp-server",
    );
    expect(screen.getByRole("link", { name: "Website" })).toHaveAttribute(
      "href",
      "https://exa.ai",
    );
    expect(document.querySelector(`.${"mcp-detail"}__external`)).not.toBeInTheDocument();
  });

  it("shows disabled source buttons when GitHub and Website are unavailable", async () => {
    const detail = controlledPromise<ReturnType<typeof okJson>>();
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/marketplace/mcp/items/exa")) {
        return detail.promise;
      }
      if (url.includes("/api/mcp/servers")) {
        return okJson({ columns: [], entries: [], issues: [] });
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderView(itemFixture({ githubUrl: null, websiteUrl: null, homepage: null }));

    await act(async () => {
      detail.resolve(okJson(detailFixture({ githubUrl: null, websiteUrl: null })));
    });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Exa Search" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: "View in MCP Registry" })).toBeInTheDocument();
    const githubButton = screen.getByRole("button", { name: "GitHub unavailable" });
    expect(githubButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Website unavailable" })).toBeDisabled();
    fireEvent.focus(githubButton.closest(".ui-tooltip-trigger")!);
    await waitFor(() => {
      expect(document.querySelector(".ui-popup--tooltip")).toHaveTextContent(
        "No GitHub repository is listed for this MCP server.",
      );
    });
  });
});
