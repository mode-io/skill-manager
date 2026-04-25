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
  });

  it("keeps enable as a direct set-harnesses action", async () => {
    const inventory = inventoryFixture();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers/exa/set-harnesses")) {
        expect(init?.method).toBe("POST");
        return okJson({ ok: true, succeeded: ["cursor"], failed: [] });
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
