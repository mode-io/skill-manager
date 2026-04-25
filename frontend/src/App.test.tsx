import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { createRouteFetchMock, okJson } from "./test/fetch";
import { mcpInventoryEntry, mcpInventoryPayload } from "./test/fixtures/mcp";
import { skillsPayload } from "./test/fixtures/skills";
import { renderWithRouter, stubDesktopMatchMedia } from "./test/render";

const fetchMock = vi.fn();

function renderApp(initialRoute = "/") {
  return renderWithRouter(<App />, { route: initialRoute });
}

function stubEmptyApi() {
  fetchMock.mockImplementation(
    createRouteFetchMock(
      [
        { match: "/api/skills", response: skillsPayload() },
        { match: "/api/mcp/servers", response: mcpInventoryPayload() },
        { match: "/api/settings", response: { harnesses: [] } },
        {
          match: (url) =>
            url.startsWith("/api/marketplace/popular") ||
            url.startsWith("/api/marketplace/search") ||
            url.startsWith("/api/marketplace/clis/popular") ||
            url.startsWith("/api/marketplace/clis/search"),
          response: { items: [], nextOffset: null, hasMore: false },
        },
      ],
      () => okJson({}),
    ),
  );
}

describe("App shell", () => {
  beforeEach(() => {
    stubDesktopMatchMedia();
    stubEmptyApi();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("renders the sidebar with primary nav groups", async () => {
    renderApp("/skills/use");
    await waitFor(() => expect(screen.getByLabelText(/primary navigation/i)).toBeInTheDocument());
    expect(screen.getByText(/skill-manager/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Overview$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Skills/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /MCP Servers/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Marketplace/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Settings$/i })).toBeInTheDocument();
  });

  it("renders right-aligned section counts for skills and MCP servers", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/skills") {
        return okJson(skillsPayload({ managed: 10, unmanaged: 3 }));
      }
      if (url === "/api/mcp/servers") {
        return okJson(
          mcpInventoryPayload([
            mcpInventoryEntry({ name: "exa", kind: "managed" }),
            mcpInventoryEntry({ name: "context7", kind: "managed" }),
            mcpInventoryEntry({ name: "firecrawl", kind: "unmanaged" }),
          ]),
        );
      }
      if (url === "/api/settings") {
        return okJson({ harnesses: [] });
      }
      return okJson({});
    });

    renderApp("/settings");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Skills 13" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "MCP Servers 3" })).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "In use 10" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Needs review 3" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "In use 2" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Needs review 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marketplace" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skills" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "MCP" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CLIs" })).toBeInTheDocument();
  });

  it("omits sidebar counts before query data resolves", () => {
    fetchMock.mockImplementation(
      () => new Promise<Response>(() => {
        // Keep the query pending so the sidebar renders its unloaded state.
      }),
    );

    renderApp("/settings");

    expect(screen.getByRole("button", { name: "Skills" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "MCP Servers" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marketplace" })).toBeInTheDocument();
  });

  it.each([
    ["/overview", "Overview"],
    ["/skills/use", "Skills in use"],
    ["/skills/review", "Skills to review"],
    ["/mcp/use", "MCP servers in use"],
    ["/mcp/review", "MCP configs to review"],
    ["/marketplace/skills", "Marketplace"],
    ["/marketplace/clis", "Marketplace"],
    ["/settings", "Settings"],
  ])("renders the expected page heading for %s", async (route, heading) => {
    renderApp(route);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument(),
    );
  });

  it.each([
    ["/skills/managed", "Skills in use"],
    ["/skills/unmanaged", "Skills to review"],
    ["/mcp/managed", "MCP servers in use"],
    ["/mcp/unmanaged", "MCP configs to review"],
  ])("redirects compatibility route %s to the new concept route", async (route, heading) => {
    renderApp(route);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument(),
    );
  });

  it("shows the preview-only note only on the CLI marketplace tab", async () => {
    const note = "Preview only · Skill Manager does not install or manage CLIs";

    const cliView = renderApp("/marketplace/clis");
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Marketplace" })).toBeInTheDocument(),
    );
    const previewNote = screen.getByText(note);
    expect(previewNote).toBeInTheDocument();
    expect(previewNote.closest(".page-header")).toBeInTheDocument();
    cliView.unmount();

    renderApp("/marketplace/skills");
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Marketplace" })).toBeInTheDocument(),
    );
    expect(screen.queryByText(note)).not.toBeInTheDocument();
  });

  it("redirects / to /overview", async () => {
    renderApp("/");
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument(),
    );
  });

  it("redirects retired /harnesses to /overview", async () => {
    renderApp("/harnesses");
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument(),
    );
  });

  it("navigates to overview from the skill-manager brand", async () => {
    renderApp("/settings");
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("link", { name: /skill-manager/i }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument(),
    );
  });
});
