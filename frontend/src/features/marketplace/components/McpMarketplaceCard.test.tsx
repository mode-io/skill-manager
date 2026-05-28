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
    externalUrl: overrides.externalUrl ?? "https://registry.modelcontextprotocol.io/?q=exa",
  };
}

function detailPayload(item: McpMarketplaceItemDto, overrides: Record<string, unknown> = {}) {
  return {
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
    installConfig: { required: false, fields: [] },
    ...overrides,
  };
}

function renderCard(
  item: McpMarketplaceItemDto,
  inventoryPayload: object = { columns: [], entries: [] },
  detailOverrides: Record<string, unknown> = {},
) {
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    if (url.includes("/api/mcp/servers") && method === "GET") {
      return okJson(inventoryPayload);
    }
    if (url.includes("/api/marketplace/mcp/items") && method === "GET") {
      return okJson(detailPayload(item, detailOverrides));
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
    expect(screen.getByRole("button", { name: /install exa search/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /install exa search/i })).toHaveTextContent("Install");
    expect(screen.queryByText("Remote")).not.toBeInTheDocument();
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
    expect(screen.queryByText("1.2k")).not.toBeInTheDocument();
  });

  it("falls back to a single initial when an item has no icon", () => {
    const { container } = renderCard(createItem({ iconUrl: null, displayName: "Exa Search" }));

    expect(container.querySelector(".market-card__avatar")).toHaveTextContent("E");
    expect(container.querySelector(".market-card__avatar")).not.toHaveTextContent("EX");
  });

  it("keeps full long text available while using marketplace card text slots", () => {
    const longName = "Very Long MCP Server Display Name That Should Truncate Like Skill Marketplace Cards";
    const longQualifiedName = "@very-long-namespace/very-long-mcp-server-name-that-should-ellipsize";
    const longDescription =
      "This MCP server description is intentionally long so the card should clamp it instead of stretching the marketplace grid layout.";
    const { container } = renderCard(
      createItem({
        displayName: longName,
        qualifiedName: longQualifiedName,
        description: longDescription,
      }),
    );

    expect(container.querySelector(".market-card__title")).toHaveAttribute("title", longName);
    expect(container.querySelector(".market-card__repo")).toHaveAttribute("title", longQualifiedName);
    expect(container.querySelector(".market-card__body")).toHaveAttribute("title", longDescription);
  });

  it("does not open detail when the install button is clicked", async () => {
    const { onOpenDetail } = renderCard(createItem());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /install exa search/i })).toBeEnabled(),
    );
    const button = screen.getByRole("button", { name: /install exa search/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/mcp/servers"),
        expect.objectContaining({ method: "POST" }),
      );
    });
    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes("/api/mcp/servers") && init?.method === "POST",
    );
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      qualifiedName: "@exa/exa-mcp",
    });
    expect(screen.queryByRole("button", { name: /cursor/i })).not.toBeInTheDocument();
    expect(onOpenDetail).not.toHaveBeenCalled();
  });

  it("renders an install button for local items", async () => {
    renderCard(createItem({ isRemote: false, isDeployed: false }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /install exa search/i })).toBeEnabled(),
    );
    const button = screen.getByRole("button", { name: /install exa search/i });

    fireEvent.click(button);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/mcp/servers"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("installs directly when registry install fields are required", async () => {
    renderCard(createItem(), { columns: [], entries: [] }, {
      installConfig: {
        required: true,
        fields: [
          {
            name: "CUEAPI_API_KEY",
            label: "CUEAPI_API_KEY",
            description: "CueAPI API key. Generate at https://cueapi.ai or app.i18nagent.ai.",
            format: "string",
            required: true,
            secret: true,
            default: null,
            placeholder: null,
            choices: [],
            target: "env",
          },
        ],
      },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /install exa search/i })).toBeEnabled(),
    );

    fireEvent.click(screen.getByRole("button", { name: /install exa search/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/mcp/servers"),
        expect.objectContaining({
          method: "POST",
        }),
      );
    });
    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes("/api/mcp/servers") && init?.method === "POST",
    );
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({ qualifiedName: "@exa/exa-mcp" });
    expect(screen.queryByLabelText(/CUEAPI_API_KEY/i, { selector: "input" })).not.toBeInTheDocument();
  });

  it("keeps undeployed remote items installable as registry MCP installs", async () => {
    renderCard(createItem({ isRemote: true, isDeployed: false }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /install exa search/i })).toBeEnabled(),
    );
    const button = screen.getByRole("button", { name: /install exa search/i });
    fireEvent.click(button);
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
