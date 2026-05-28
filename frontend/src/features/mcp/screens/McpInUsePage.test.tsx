import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { okJson } from "../../../test/fetch";
import { renderWithAppProviders } from "../../../test/render";
import type { McpInventoryDto } from "../api/management-types";
import McpInUsePage from "./McpInUsePage";

const fetchMock = vi.fn();
let storage: Map<string, string>;

function inventoryFixture(): McpInventoryDto {
  return {
    columns: [
      { harness: "codex", label: "Codex", logoKey: "codex", installed: true, configPresent: true, mcpWritable: true },
      { harness: "claude", label: "Claude", logoKey: "claude", installed: true, configPresent: true, mcpWritable: true },
      { harness: "cursor", label: "Cursor", logoKey: "cursor", installed: true, configPresent: true, mcpWritable: true },
    ],
    entries: [
      {
        name: "exa",
        displayName: "Exa Search",
        kind: "managed",
        canEnable: true,
        enabledStatus: "enabled",
        availabilityStatus: "available",
        availabilityReason: null,
        mcpStatus: { kind: "available", reason: null },
        installConfigStatus: { hasFields: false, missingRequired: [], configured: true },
        spec: {
          name: "exa",
          displayName: "Exa Search",
          source: { kind: "marketplace", locator: "exa" },
          transport: "http",
          url: "https://exa.run.tools",
          installedAt: "2026-04-21T00:00:00Z",
          revision: "abc",
        },
        sightings: [
          { harness: "codex", state: "managed" },
          { harness: "claude", state: "missing" },
          { harness: "cursor", state: "missing" },
        ],
      },
      {
        name: "ctx",
        displayName: "Context7",
        kind: "managed",
        canEnable: true,
        enabledStatus: "disabled",
        availabilityStatus: "unavailable",
        availabilityReason: null,
        mcpStatus: {
          kind: "unchecked",
          reason: null,
        },
        installConfigStatus: { hasFields: false, missingRequired: [], configured: true },
        spec: {
          name: "ctx",
          displayName: "Context7",
          source: { kind: "marketplace", locator: "context7" },
          transport: "stdio",
          command: "uvx",
          args: ["context7-mcp"],
          installedAt: "2026-04-21T00:00:00Z",
          revision: "def",
        },
        sightings: [
          { harness: "codex", state: "missing" },
          { harness: "claude", state: "missing" },
          { harness: "cursor", state: "missing" },
        ],
      },
    ],
  };
}

function driftInventoryFixture(): McpInventoryDto {
  const inventory = inventoryFixture();
  return {
    ...inventory,
    entries: [
      {
        ...inventory.entries[0],
        mcpStatus: {
          kind: "connection_issue",
          reason: null,
        },
        sightings: [
          { harness: "codex", state: "managed" },
          { harness: "claude", state: "drifted", driftDetail: "changed=url" },
          { harness: "cursor", state: "missing" },
        ],
      },
      inventory.entries[1],
    ],
  };
}

function emptyInventory() {
  return { columns: [], entries: [] };
}

function marketplaceDetailFixture(overrides: Record<string, unknown> = {}) {
  return {
    qualifiedName: "exa",
    managedName: "exa",
    displayName: "Exa Search",
    description: "Fast search.",
    iconUrl: null,
    isRemote: true,
    connections: [],
    tools: [],
    resources: [],
    prompts: [],
    capabilityCounts: { tools: 0, resources: 0, prompts: 0 },
    externalUrl: "https://registry.modelcontextprotocol.io/?q=exa",
    installConfig: { required: false, fields: [] },
    ...overrides,
  };
}

function renderPage(route = "/mcp/use") {
  return renderWithAppProviders(<McpInUsePage />, { route });
}

describe("McpInUsePage", () => {
  beforeEach(() => {
    storage = new Map();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          storage.set(key, value);
        }),
        removeItem: vi.fn((key: string) => {
          storage.delete(key);
        }),
      },
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("renders an empty state with a marketplace CTA when no servers are in use", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers")) return okJson(emptyInventory());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /no mcp servers in use yet/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: /open marketplace/i })).toHaveAttribute(
      "href",
      "/marketplace/mcp",
    );
  });

  it("renders cards for each server in use with the X/N count", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers")) return okJson(inventoryFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Exa Search")).toBeInTheDocument());
    expect(screen.getByLabelText("MCP servers list")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "MCP server harness matrix" })).not.toBeInTheDocument();
    expect(screen.getByText("Context7")).toBeInTheDocument();
    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.getByText("0/3")).toBeInTheDocument();
    expect(screen.getByLabelText("MCP status: Available")).toBeInTheDocument();
    expect(screen.getByLabelText("MCP status: Unchecked")).toBeInTheDocument();
  });

  it("renders all public MCP status labels", async () => {
    const inventory = inventoryFixture();
    inventory.entries = [
      inventory.entries[0],
      inventory.entries[1],
      {
        ...inventory.entries[1],
        name: "needs-config",
        displayName: "Needs Config",
        mcpStatus: { kind: "needs_config", reason: null },
        installConfigStatus: {
          hasFields: true,
          missingRequired: ["API_KEY"],
          configured: false,
        },
      },
      {
        ...inventory.entries[1],
        name: "failed",
        displayName: "Failed MCP",
        availabilityReason: "Connection refused",
        mcpStatus: { kind: "connection_issue", reason: "Connection refused" },
      },
    ];
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers")) return okJson(inventory);
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Exa Search")).toBeInTheDocument());

    expect(screen.getByLabelText("MCP status: Available")).toBeInTheDocument();
    expect(screen.getByLabelText("MCP status: Unchecked")).toBeInTheDocument();
    expect(screen.getByLabelText("MCP status: Needs config")).toBeInTheDocument();
    expect(screen.getByLabelText("MCP status: Connection issue")).toBeInTheDocument();
  });

  it("renders the matrix view from the URL parameter", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers")) return okJson(inventoryFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage("/mcp/use?view=matrix");
    await waitFor(() =>
      expect(screen.getByRole("table", { name: "MCP server harness matrix" })).toBeInTheDocument(),
    );
    expect(screen.queryByLabelText("MCP servers list")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Enabled on 1 of 3 writable harnesses")).toBeInTheDocument();
  });

  it("switches between cards and matrix views", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers")) return okJson(inventoryFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByLabelText("MCP servers list")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Matrix" }));
    expect(await screen.findByRole("table", { name: "MCP server harness matrix" })).toBeInTheDocument();
    expect(window.localStorage.getItem("skillmgr.mcp.inUse.view")).toBe("matrix");
    fireEvent.click(screen.getByRole("button", { name: "Cards" }));
    expect(await screen.findByLabelText("MCP servers list")).toBeInTheDocument();
  });

  it("filters servers by search input", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers")) return okJson(inventoryFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage("/mcp/use?view=matrix");
    await waitFor(() => expect(screen.getByText("Exa Search")).toBeInTheDocument());
    const searchBox = screen.getByLabelText(/search mcp servers/i);
    fireEvent.change(searchBox, { target: { value: "exa" } });
    await waitFor(() => expect(screen.queryByText("Context7")).not.toBeInTheDocument());
    expect(screen.getByText("Exa Search")).toBeInTheDocument();
  });

  it("opens detail from matrix row identity", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers/exa")) {
        return okJson({
          ...inventoryFixture().entries[0],
          env: [],
          configChoices: [],
          marketplaceLink: null,
        });
      }
      if (url.includes("/api/mcp/servers")) return okJson(inventoryFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage("/mcp/use?view=matrix");
    await waitFor(() => expect(screen.getByRole("button", { name: "Open detail for Exa Search" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Open detail for Exa Search" }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).includes("/api/mcp/servers/exa")),
      ).toBe(true),
    );
  });

  it("surfaces the bulk action bar when a card is checked", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers")) return okJson(inventoryFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Exa Search")).toBeInTheDocument());
    const checkbox = screen.getByRole("checkbox", { name: /select exa search/i });
    fireEvent.click(checkbox);
    await waitFor(() =>
      expect(screen.getByRole("toolbar", { name: /bulk actions/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /uninstall 1 selected/i })).toBeInTheDocument();
  });

  it("opens a confirm dialog when uninstall is selected from the card menu", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers")) return okJson(inventoryFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Exa Search")).toBeInTheDocument());
    const menu = screen.getByRole("button", { name: /more actions for exa search/i });
    fireEvent.click(menu);
    const uninstall = await screen.findByRole("button", { name: /^uninstall$/i });
    fireEvent.click(uninstall);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /uninstall exa search\?/i })).toBeInTheDocument(),
    );
    expect(screen.queryByText(/confirm uninstall/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/drifted harness entries are preserved/i)).not.toBeInTheDocument();
    expect(screen.getByText(/delete its bindings from all harnesses where it is currently present/i)).toBeInTheDocument();
  });

  it("uses the shared confirm dialog for bulk uninstall", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers")) return okJson(inventoryFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Exa Search")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox", { name: /select exa search/i }));
    fireEvent.click(screen.getByRole("button", { name: /uninstall 1 selected/i }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /uninstall 1 server\?/i })).toBeInTheDocument(),
    );
    expect(screen.queryByText(/confirm uninstall/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/drifted harness entries are preserved/i)).not.toBeInTheDocument();
    expect(screen.getByText(/delete its bindings from all harnesses where it is currently present/i)).toBeInTheDocument();
  });

  it("calls set-harnesses when the power button is pressed", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers/exa/set-harnesses")) {
        expect(init?.method).toBe("POST");
        return okJson({ ok: true, succeeded: ["codex"], failed: [] });
      }
      if (url.includes("/api/mcp/servers/exa/availability/check")) {
        expect(init?.method).toBe("POST");
        return okJson({
          ok: true,
          name: "exa",
          availabilityStatus: "available",
          availabilityReason: null,
        });
      }
      if (url.includes("/api/marketplace/mcp/items/exa")) {
        return okJson(marketplaceDetailFixture());
      }
      if (url.includes("/api/mcp/servers")) return okJson(inventoryFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Exa Search")).toBeInTheDocument());
    const enableButtons = screen.getAllByLabelText(/enable on all harnesses/i);
    fireEvent.click(enableButtons[0]);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) =>
          String(call[0]).includes("/api/mcp/servers/exa/set-harnesses"),
        ),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) =>
          String(call[0]).includes("/api/mcp/servers/exa/availability/check"),
        ),
      ).toBe(true),
    );
  });

  it("checks availability automatically for managed servers with no cached result", async () => {
    const inventory = inventoryFixture();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers/exa/availability/check")) {
        expect(init?.method).toBe("POST");
        return okJson({
          ok: true,
          name: "exa",
          availabilityStatus: "available",
          availabilityReason: null,
        });
      }
      if (url.includes("/api/mcp/servers")) {
        return okJson({
          ...inventory,
          entries: [
            {
              ...inventory.entries[0],
              availabilityStatus: "unavailable",
              availabilityReason: null,
              mcpStatus: {
                kind: "unchecked",
                reason: null,
              },
            },
            inventory.entries[1],
          ],
        });
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Exa Search")).toBeInTheDocument());

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) =>
          String(call[0]).includes("/api/mcp/servers/exa/availability/check"),
        ),
      ).toBe(true),
    );
  });

  it("does not check availability automatically when a connection failure is cached", async () => {
    const inventory = inventoryFixture();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers/exa/availability/check")) {
        return okJson({
          ok: true,
          name: "exa",
          availabilityStatus: "available",
          availabilityReason: null,
        });
      }
      if (url.includes("/api/mcp/servers")) {
        expect(init?.method ?? "GET").toBe("GET");
        return okJson({
          ...inventory,
          entries: [
            {
              ...inventory.entries[0],
              availabilityStatus: "unavailable",
              availabilityReason: "Connection refused",
              mcpStatus: {
                kind: "connection_issue",
                reason: "Connection refused",
              },
            },
            inventory.entries[1],
          ],
        });
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Exa Search")).toBeInTheDocument());

    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes("/api/mcp/servers/exa/availability/check"),
      ),
    ).toBe(false);
  });

  it("refreshes availability after enabling from the detail binding row", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers/exa/enable")) {
        expect(init?.method).toBe("POST");
        return okJson({ ok: true });
      }
      if (url.includes("/api/mcp/servers/exa/availability/check")) {
        expect(init?.method).toBe("POST");
        return okJson({
          ok: true,
          name: "exa",
          availabilityStatus: "available",
          availabilityReason: null,
        });
      }
      if (url.includes("/api/marketplace/mcp/items/exa")) {
        return okJson({
          qualifiedName: "exa",
          managedName: "exa",
          displayName: "Exa Search",
          description: "Fast search.",
          iconUrl: null,
          isRemote: false,
          connections: [],
          tools: [],
          resources: [],
          prompts: [],
          capabilityCounts: { tools: 0, resources: 0, prompts: 0 },
          externalUrl: "https://registry.modelcontextprotocol.io/?q=exa",
          installConfig: { required: false, fields: [] },
        });
      }
      if (url.includes("/api/mcp/servers/exa")) {
        return okJson({
          ...inventoryFixture().entries[0],
          env: [],
          configChoices: [],
          marketplaceLink: null,
        });
      }
      if (url.includes("/api/mcp/servers")) return okJson(inventoryFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage("/mcp/use?server=exa");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Exa Search" })).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button", { name: "Enable" })[0]);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) =>
          String(call[0]).includes("/api/mcp/servers/exa/enable"),
        ),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) =>
          String(call[0]).includes("/api/mcp/servers/exa/availability/check"),
        ),
      ).toBe(true),
    );
  });

  it("uses set-harnesses when no install config is required", async () => {
    const inventory = inventoryFixture();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers/exa/set-harnesses")) {
        expect(init?.method).toBe("POST");
        return okJson({ ok: true, succeeded: ["cursor"], failed: [] });
      }
      if (url.includes("/api/marketplace/mcp/items/exa")) {
        return okJson(marketplaceDetailFixture());
      }
      if (url.includes("/api/mcp/servers")) return okJson(inventory);
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Exa Search")).toBeInTheDocument());
    fireEvent.click(screen.getAllByLabelText(/enable on all harnesses/i)[0]);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) =>
          String(call[0]).includes("/api/mcp/servers/exa/set-harnesses"),
        ),
      ).toBe(true),
    );
  });

  it("does not fetch registry config when install fields are optional only", async () => {
    const inventory = inventoryFixture();
    inventory.entries[0] = {
      ...inventory.entries[0],
      installConfigStatus: {
        hasFields: true,
        missingRequired: [],
        configured: true,
      },
    };
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers/exa/set-harnesses")) {
        expect(init?.method).toBe("POST");
        return okJson({ ok: true, succeeded: ["cursor"], failed: [] });
      }
      if (url.includes("/api/marketplace/mcp/items/exa")) {
        throw new Error("registry detail should not be loaded for optional-only fields");
      }
      if (url.includes("/api/mcp/servers")) return okJson(inventory);
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Exa Search")).toBeInTheDocument());
    fireEvent.click(screen.getAllByLabelText(/enable on all harnesses/i)[0]);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) =>
          String(call[0]).includes("/api/mcp/servers/exa/set-harnesses"),
        ),
      ).toBe(true),
    );
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes("/api/marketplace/mcp/items/exa"),
      ),
    ).toBe(false);
  });

  it("collects required install config before enabling all from a card", async () => {
    const inventory = inventoryFixture();
    inventory.entries[0] = {
      ...inventory.entries[0],
      installConfigStatus: {
        hasFields: true,
        missingRequired: ["EXA_API_KEY"],
        configured: false,
      },
      mcpStatus: {
        kind: "needs_config",
        reason: null,
      },
    };
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers/exa/set-harnesses")) {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          target: "enabled",
          config: { EXA_API_KEY: "secret" },
        });
        return okJson({ ok: true, succeeded: ["cursor"], failed: [] });
      }
      if (url.includes("/api/marketplace/mcp/items/exa")) {
        return okJson(marketplaceDetailFixture({
          installConfig: {
            required: true,
            fields: [
              {
                name: "EXA_API_KEY",
                label: "EXA_API_KEY",
                description: "Exa API key",
                format: "string",
                required: true,
                secret: true,
                default: null,
              },
            ],
          },
        }));
      }
      if (url.includes("/api/mcp/servers")) return okJson(inventory);
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Exa Search")).toBeInTheDocument());
    fireEvent.click(screen.getAllByLabelText(/enable on all harnesses/i)[0]);

    await waitFor(() =>
      expect(screen.getAllByRole("heading", { name: /configure exa search/i }).length).toBeGreaterThan(0),
    );
    fireEvent.change(screen.getByLabelText(/EXA_API_KEY/), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) =>
          String(call[0]).includes("/api/mcp/servers/exa/set-harnesses"),
        ),
      ).toBe(true),
    );
  });

  it("blocks multi-select enable when one selected server needs config", async () => {
    const inventory = inventoryFixture();
    inventory.entries[0] = {
      ...inventory.entries[0],
      installConfigStatus: {
        hasFields: true,
        missingRequired: ["EXA_API_KEY"],
        configured: false,
      },
      mcpStatus: {
        kind: "needs_config",
        reason: null,
      },
    };
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers/exa/set-harnesses")) {
        throw new Error("multi-select should not enable servers that need config");
      }
      if (url.includes("/api/mcp/servers")) return okJson(inventory);
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Exa Search")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox", { name: /select exa search/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /select context7/i }));
    fireEvent.click(screen.getByRole("button", { name: /^enable all$/i }));

    await waitFor(() =>
      expect(screen.getByText(/exa search requires credentials/i)).toBeInTheDocument(),
    );
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes("/api/mcp/servers/exa/set-harnesses"),
      ),
    ).toBe(false);
  });

  it("opens detail instead of toggling all when a server has a different config", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers/exa")) {
        return okJson({
          ...driftInventoryFixture().entries[0],
          env: [],
          configChoices: [],
          marketplaceLink: null,
        });
      }
      if (url.includes("/api/mcp/servers")) return okJson(driftInventoryFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Exa Search")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Resolve config" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).includes("/api/mcp/servers/exa")),
      ).toBe(true),
    );
  });
});
