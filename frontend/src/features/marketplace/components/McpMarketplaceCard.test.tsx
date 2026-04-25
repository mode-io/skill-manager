import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UiTooltipProvider } from "../../../components/ui/UiTooltipProvider";
import type { McpMarketplaceItemDto } from "../api/mcp-types";
import { InstallingProvider } from "../model/installing-context";
import { McpMarketplaceCard } from "./McpMarketplaceCard";

const fetchMock = vi.fn();

function okJson(payload: object) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => payload,
  };
}

function createItem(overrides: Partial<McpMarketplaceItemDto> = {}): McpMarketplaceItemDto {
  return {
    qualifiedName: overrides.qualifiedName ?? "@exa/exa-mcp",
    namespace: overrides.namespace ?? "exa",
    displayName: overrides.displayName ?? "Exa Search",
    description: overrides.description ?? "Fast, intelligent web search and crawling.",
    iconUrl: overrides.iconUrl ?? null,
    isVerified: overrides.isVerified ?? true,
    isRemote: overrides.isRemote ?? true,
    isDeployed: overrides.isDeployed ?? true,
    useCount: overrides.useCount ?? 1200,
    createdAt: overrides.createdAt ?? null,
    homepage: overrides.homepage ?? null,
    externalUrl: overrides.externalUrl ?? "https://smithery.ai/server/exa",
  };
}

function renderCard(
  item: McpMarketplaceItemDto,
  inventoryPayload: object = { columns: [], entries: [] },
) {
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    if (url.includes("/api/marketplace/mcp/install-targets") && method === "GET") {
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
          {
            harness: "claude",
            label: "Claude",
            logoKey: "claude",
            smitheryClient: "claude-code",
            supported: true,
            reason: null,
          },
          {
            harness: "openclaw",
            label: "OpenClaw",
            logoKey: "openclaw",
            smitheryClient: null,
            supported: false,
            reason: "Smithery does not provide an OpenClaw MCP installer target",
          },
        ],
      });
    }
    if (url.includes("/api/mcp/servers") && method === "GET") {
      return okJson(inventoryPayload);
    }
    if (url.includes("/api/marketplace/mcp/items") && method === "GET") {
      return okJson({
        qualifiedName: item.qualifiedName,
        managedName: "exa-mcp",
        displayName: item.displayName,
        description: item.description,
        iconUrl: item.iconUrl,
        isRemote: item.isRemote,
        deploymentUrl: "https://exa.run.tools",
        connections: [],
        tools: [],
        resources: [],
        prompts: [],
        capabilityCounts: { tools: 0, resources: 0, prompts: 0 },
        externalUrl: item.externalUrl,
      });
    }
    if (url.includes("/api/mcp/servers") && method === "POST") {
      return okJson({
        ok: true,
        server: {
          name: "exa-mcp",
          displayName: "Exa Search",
          source: { kind: "marketplace", locator: item.qualifiedName },
          transport: "http",
          url: "https://exa.run.tools",
          installedAt: "2026-04-23T00:00:00Z",
          revision: "abc",
        },
      });
    }
    throw new Error(`Unhandled URL ${url}`);
  });

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onOpenDetail = vi.fn();
  const utils = render(
    <QueryClientProvider client={client}>
      <UiTooltipProvider delayDuration={0} skipDelayDuration={0}>
        <MemoryRouter>
          <InstallingProvider>
            <McpMarketplaceCard
              item={item}
              selected={false}
              onOpenDetail={onOpenDetail}
            />
          </InstallingProvider>
        </MemoryRouter>
      </UiTooltipProvider>
    </QueryClientProvider>,
  );
  return { ...utils, onOpenDetail };
}

describe("McpMarketplaceCard", () => {
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

  it("renders an install button for remote deployed items", () => {
    renderCard(createItem());
    expect(screen.getByRole("button", { name: /add exa search to mcps/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add exa search to mcps/i })).toHaveTextContent("Add to MCPs");
  });

  it("does not open detail when the install button is clicked", async () => {
    const { onOpenDetail } = renderCard(createItem());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /add exa search to mcps/i })).toBeEnabled(),
    );
    const button = screen.getByRole("button", { name: /add exa search to mcps/i });
    fireEvent.click(button);
    expect(await screen.findByRole("button", { name: /claude/i })).toHaveTextContent("claude-code");
    expect(screen.queryByRole("button", { name: /openclaw/i })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /cursor/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/mcp/servers"),
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(onOpenDetail).not.toHaveBeenCalled();
  });

  it("renders an install button for local items", async () => {
    renderCard(createItem({ isRemote: false, isDeployed: false }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /add exa search to mcps/i })).toBeEnabled(),
    );
    const button = screen.getByRole("button", { name: /add exa search to mcps/i });

    fireEvent.click(button);
    fireEvent.click(await screen.findByRole("button", { name: /cursor/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/mcp/servers"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("keeps undeployed remote items installable because Smithery writes the source config", async () => {
    renderCard(createItem({ isRemote: true, isDeployed: false }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /add exa search to mcps/i })).toBeEnabled(),
    );
    const button = screen.getByRole("button", { name: /add exa search to mcps/i });
    fireEvent.click(button);
    fireEvent.click(await screen.findByRole("button", { name: /cursor/i }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/mcp/servers"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("renders 'Open in MCPs' when the server is already managed", async () => {
    renderCard(createItem(), {
      columns: [],
      entries: [
        {
          name: "exa-mcp",
          displayName: "Exa Search",
          kind: "managed",
          canEnable: true,
          spec: {
            name: "exa-mcp",
            displayName: "Exa Search",
            source: { kind: "marketplace", locator: "@exa/exa-mcp" },
            transport: "http",
            installedAt: "2026-04-23T00:00:00Z",
            revision: "",
            url: "https://exa.run.tools",
          },
          sightings: [],
        },
      ],
    });

    const link = await screen.findByRole("link", { name: /open exa search in mcps/i });
    expect(link).toHaveAttribute("href", "/mcp/use?server=exa-mcp");
  });
});
