import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { okJson } from "../../../test/fetch";
import { renderWithAppProviders } from "../../../test/render";
import { InstallingProvider } from "../model/installing-context";
import MarketplaceMcpPage from "./MarketplaceMcpPage";

const fetchMock = vi.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function pageItem() {
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

function detailPayload() {
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

function renderPage() {
  return renderWithAppProviders(
    <InstallingProvider>
      <MarketplaceMcpPage
        isActive
        query=""
        onQueryChange={() => undefined}
        onItemCountChange={() => undefined}
      />
    </InstallingProvider>,
    { route: "/marketplace/mcp" },
  );
}

describe("MarketplaceMcpPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("opens the detail modal while install targets are still loading", async () => {
    const installTargets = deferred<ReturnType<typeof okJson>>();
    const detail = deferred<ReturnType<typeof okJson>>();
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/marketplace/mcp/popular?limit=30&offset=0")) {
        return okJson({ items: [pageItem()], nextOffset: null, hasMore: false });
      }
      if (url.includes("/api/marketplace/mcp/install-targets")) {
        return installTargets.promise;
      }
      if (url.includes("/api/marketplace/mcp/items/exa")) {
        return detail.promise;
      }
      if (url.includes("/api/mcp/servers")) {
        return okJson({ columns: [], entries: [], issues: [] });
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();

    await waitFor(() => expect(screen.getByText("Exa Search")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /open mcp marketplace detail for exa search/i }));

    expect(screen.getByRole("status", { name: "Loading MCP details" })).toBeInTheDocument();

    await act(async () => {
      detail.resolve(okJson(detailPayload()));
    });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Exa Search" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /add exa search to mcps \(unavailable\)/i }))
      .toBeDisabled();

    await act(async () => {
      installTargets.resolve(okJson({ targets: [] }));
    });
  });
});
