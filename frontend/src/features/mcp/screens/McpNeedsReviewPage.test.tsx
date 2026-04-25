import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { okJson } from "../../../test/fetch";
import { renderWithAppProviders } from "../../../test/render";
import McpNeedsReviewPage from "./McpNeedsReviewPage";

const fetchMock = vi.fn();

function emptyByServer() {
  return { harnesses: [], servers: [], issues: [] };
}

function identicalByServerFixture() {
  return {
    harnesses: [],
    issues: [],
    servers: [
      {
        name: "context7",
        identical: true,
        canonicalSpec: {
          name: "context7",
          displayName: "context7",
          source: { kind: "adopted", locator: "cursor:context7" },
          transport: "stdio",
          command: "uvx",
          args: ["context7-mcp"],
          installedAt: "2026-04-21T00:00:00Z",
          revision: "abc",
        },
        marketplaceLink: null,
        sightings: [
          {
            harness: "cursor",
            label: "Cursor",
            logoKey: "cursor",
            configPath: "/c/.cursor/mcp.json",
            payloadPreview: { command: "uvx", args: ["context7-mcp"] },
            spec: {
              name: "context7",
              displayName: "context7",
              source: { kind: "adopted", locator: "cursor:context7" },
              transport: "stdio",
              command: "uvx",
              args: ["context7-mcp"],
              installedAt: "2026-04-21T00:00:00Z",
              revision: "abc",
            },
            env: [],
          },
          {
            harness: "claude",
            label: "Claude",
            logoKey: "claude",
            configPath: "/c/.claude.json",
            payloadPreview: { command: "uvx", args: ["context7-mcp"] },
            spec: {
              name: "context7",
              displayName: "context7",
              source: { kind: "adopted", locator: "claude:context7" },
              transport: "stdio",
              command: "uvx",
              args: ["context7-mcp"],
              installedAt: "2026-04-21T00:00:00Z",
              revision: "abc",
            },
            env: [],
          },
        ],
      },
    ],
  };
}

function differingByServerFixture() {
  return {
    harnesses: [],
    issues: [],
    servers: [
      {
        name: "context7",
        identical: false,
        canonicalSpec: null,
        marketplaceLink: null,
        sightings: [
          {
            harness: "cursor",
            label: "Cursor",
            logoKey: "cursor",
            configPath: "/c/.cursor/mcp.json",
            payloadPreview: { command: "uvx", args: ["context7-mcp"] },
            spec: {
              name: "context7",
              displayName: "context7",
              source: { kind: "adopted", locator: "cursor:context7" },
              transport: "stdio",
              command: "uvx",
              args: ["context7-mcp"],
              installedAt: "2026-04-21T00:00:00Z",
              revision: "abc",
            },
            env: [],
          },
          {
            harness: "claude",
            label: "Claude",
            logoKey: "claude",
            configPath: "/c/.claude.json",
            payloadPreview: { url: "https://context7.example" },
            spec: {
              name: "context7",
              displayName: "context7",
              source: { kind: "adopted", locator: "claude:context7" },
              transport: "http",
              url: "https://context7.example",
              installedAt: "2026-04-21T00:00:00Z",
              revision: "def",
            },
            env: [],
          },
        ],
      },
    ],
  };
}

function renderPage() {
  return renderWithAppProviders(<McpNeedsReviewPage />, { route: "/mcp/review" });
}

describe("McpNeedsReviewPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("renders the empty state when no local MCP configs need review", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers")) return okJson({ columns: [], entries: [] });
      if (url.includes("/api/mcp/unmanaged/by-server")) return okJson(emptyByServer());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /no local MCP configs need review/i })).toBeInTheDocument(),
    );
  });

  it("renders identity-first rows for identical servers across harnesses", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers")) return okJson({ columns: [], entries: [] });
      if (url.includes("/api/mcp/unmanaged/by-server"))
        return okJson(identicalByServerFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("context7")).toBeInTheDocument());
    expect(screen.getByText(/Identical/)).toBeInTheDocument();
    const adoptButton = screen.getByRole("button", { name: /^Adopt$/ });
    expect(adoptButton).toBeInTheDocument();
  });

  it("renders choose-config action when harness payloads differ", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/servers")) return okJson({ columns: [], entries: [] });
      if (url.includes("/api/mcp/unmanaged/by-server"))
        return okJson(differingByServerFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("context7")).toBeInTheDocument());
    expect(screen.getByText(/Differs across harnesses/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Choose config to adopt$/ })).toBeInTheDocument();
  });

  it("calls adopt when the row button is clicked", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/mcp/unmanaged/adopt")) {
        expect(init?.method).toBe("POST");
        const body = init?.body ? JSON.parse(init.body as string) : {};
        expect(body.name).toBe("context7");
        return okJson({
          ok: true,
          server: { name: "context7", displayName: "context7" },
          succeeded: ["cursor", "claude"],
          failed: [],
        });
      }
      if (url.includes("/api/mcp/servers")) return okJson({ columns: [], entries: [] });
      if (url.includes("/api/mcp/unmanaged/by-server"))
        return okJson(identicalByServerFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("context7")).toBeInTheDocument());
    const adoptButton = screen.getByRole("button", { name: /^Adopt$/ });
    fireEvent.click(adoptButton);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).includes("/api/mcp/unmanaged/adopt")),
      ).toBe(true),
    );
  });
});
