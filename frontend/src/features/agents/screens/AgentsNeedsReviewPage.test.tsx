import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { okJson } from "../../../test/fetch";
import { renderWithAppProviders } from "../../../test/render";
import AgentsNeedsReviewPage from "./AgentsNeedsReviewPage";
import type { AgentInventoryDto } from "../api/types";

const fetchMock = vi.fn();

function unmanagedAgentsFixture(): AgentInventoryDto {
  return {
    columns: [
      { harness: "cursor", label: "Cursor", logoKey: "cursor", installed: true },
    ],
    issues: [],
    entries: [
      {
        ref: "claude/conflict-agent",
        name: "Conflict Agent",
        description: "Will 409",
        kind: "unmanaged",
        harnessPath: ".cursor/agents/conflict-agent.yaml",
        bindings: [
          { harness: "cursor", state: "enabled", detail: null }
        ],
        actions: { canAdopt: true, canDelete: false },
      },
      {
        ref: "opencode/ok-agent",
        name: "OK Agent",
        description: "Will 200",
        kind: "unmanaged",
        harnessPath: ".cursor/agents/ok-agent.yaml",
        bindings: [
          { harness: "cursor", state: "enabled", detail: null }
        ],
        actions: { canAdopt: true, canDelete: false },
      },
    ],
  };
}

function renderPage() {
  return renderWithAppProviders(<AgentsNeedsReviewPage />, { route: "/agents/review" });
}

describe("AgentsNeedsReviewPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("renders MatrixTable with unmanaged agents", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/agents")) return okJson(unmanagedAgentsFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole("table", { name: /Agents to review/i })).toBeInTheDocument());
    expect(screen.getByText("OK Agent")).toBeInTheDocument();
  });

  it("handles 409 conflict and resolves with keep_store", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/adopt")) {
        if (init?.body && String(init.body).includes("keep_store")) {
          expect(init?.method).toBe("POST");
          return okJson({});
        }
        return new Response(
          JSON.stringify({
            conflict: "store-name-exists",
            slug: "conflict-agent",
            storePath: "agents/conflict-agent.yaml",
            harnessPath: ".cursor/agents/conflict-agent.yaml",
          }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/agents")) return okJson(unmanagedAgentsFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Conflict Agent")).toBeInTheDocument());
    
    // click adopt for Conflict Agent
    const rows = screen.getAllByRole("row");
    const conflictRow = rows.find(r => r.textContent?.includes("Conflict Agent"));
    const adoptButton = conflictRow!.querySelector("button.action-pill")!;
    fireEvent.click(adoptButton);

    await waitFor(() => expect(screen.getByText(/Name Collision: conflict-agent/i)).toBeInTheDocument());
    
    // Click Keep project version
    const keepButton = screen.getByRole("button", { name: /Keep the project version/i });
    fireEvent.click(keepButton);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => String(call[1]?.body).includes('"onConflict":"keep_store"')),
      ).toBe(true),
    );
  });

  it("bulk adopt surfaces skipped[]", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/adopt-all")) {
        expect(init?.method).toBe("POST");
        return okJson({
          ok: true,
          adopted: ["opencode/ok-agent"],
          skipped: [{ ref: "claude/conflict-agent", reason: "conflict" }]
        });
      }
      if (url.includes("/api/agents")) return okJson(unmanagedAgentsFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("OK Agent")).toBeInTheDocument());
    
    const adoptAllButton = screen.getByRole("button", { name: /Adopt all eligible/i });
    fireEvent.click(adoptAllButton);

    await waitFor(() => expect(screen.getByText(/Skipped 1 agents due to conflicts/i)).toBeInTheDocument());
  });
});
