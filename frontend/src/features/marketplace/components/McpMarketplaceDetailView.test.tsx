import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function itemFixture(): McpMarketplaceItemDto {
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
    externalUrl: "https://smithery.ai/server/exa",
  };
}

function detailFixture(): McpMarketplaceDetailDto {
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
    externalUrl: "https://smithery.ai/server/exa",
  };
}

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UiTooltipProvider delayDuration={0} skipDelayDuration={0}>
        <MemoryRouter>
          <McpMarketplaceDetailView
            qualifiedName="exa"
            initialItem={itemFixture()}
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("transitions from loading to loaded without changing hook order", async () => {
    const detail = deferred<ReturnType<typeof okJson>>();
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/marketplace/mcp/items/exa")) {
        return detail.promise;
      }
      if (url.includes("/api/marketplace/mcp/install-targets")) {
        return okJson({
          targets: [
            {
              harness: "cursor",
              label: "Cursor",
              logoKey: "cursor",
              smitheryClient: "cursor",
              supported: true,
              reason: null,
            },
          ],
        });
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
    expect(screen.getByRole("button", { name: /add exa search to mcps/i })).toBeEnabled();
    expect(screen.getByLabelText("Source links for Exa Search")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View on smithery.ai" })).toHaveAttribute(
      "href",
      "https://smithery.ai/server/exa",
    );
    expect(document.querySelector(`.${"mcp-detail"}__external`)).not.toBeInTheDocument();
  });
});
