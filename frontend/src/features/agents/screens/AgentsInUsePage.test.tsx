import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { okJson } from "../../../test/fetch";
import { renderWithAppProviders } from "../../../test/render";
import AgentsInUsePage from "./AgentsInUsePage";
import type { AgentInventoryDto, AgentDetailDto } from "../api/types";

const fetchMock = vi.fn();

function agentDetailFixture(): AgentDetailDto {
  return {
    ref: "agent-1",
    name: "Test Agent Real Name",
    description: "Detail description",
    prompt: "Test prompt",
    tools: ["tool1", "tool2"],
    document: "# Test Doc",
    storePath: "/store/agent-1.md",
    configuration: [
      { key: "model", value: "sonnet" },
      { key: "tools", value: "tool1, tool2" },
      { key: "permissionMode", value: "acceptEdits" },
      { key: "maxTurns", value: "50" },
      { key: "hooks", value: "(1 entry)" },
      { key: "effort", value: "" },
    ],
    harnesses: [
      {
        harness: "cursor",
        label: "Cursor",
        logoKey: "cursor",
        state: "disabled",
        detail: null,
        path: "/path/to/cursor",
        installMethod: "symlink",
        installed: true,
      },
      {
        harness: "windsurf",
        label: "Windsurf",
        logoKey: "windsurf",
        state: "unsupported",
        detail: "Not compatible",
        path: "/path/to/windsurf",
        installMethod: "none",
        installed: true,
      }
    ],
    canDelete: true,
  };
}

function agentsInUseFixture(): AgentInventoryDto {
  return {
    columns: [
      { harness: "cursor", label: "Cursor", logoKey: "cursor", installed: true },
    ],
    issues: [],
    entries: [
      {
        ref: "agent-1",
        name: "Test Agent",
        description: "A test agent",
        kind: "managed",
        harnessPath: null,
        bindings: [
          { harness: "cursor", state: "disabled", detail: null }
        ],
        actions: { canAdopt: false, canDelete: true },
      },
    ],
  };
}

function renderPage() {
  return renderWithAppProviders(<AgentsInUsePage />, { route: "/agents/use" });
}

describe("AgentsInUsePage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("renders MatrixTable with agent rows", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/agents")) return okJson(agentsInUseFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByRole("table", { name: /Agents Matrix/i })).toBeInTheDocument());
    expect(screen.getByText("Test Agent")).toBeInTheDocument();
  });

  it("toggles a harness cell", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/enable")) {
        expect(init?.method).toBe("POST");
        return okJson({});
      }
      if (url.includes("/api/agents")) return okJson(agentsInUseFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Test Agent")).toBeInTheDocument());
    const enableButton = screen.getByRole("button", { name: /Enable for Cursor/i });
    fireEvent.click(enableButton);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).includes("/enable")),
      ).toBe(true),
    );
  });

  describe("Agent Detail View", () => {
    beforeEach(() => {
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url === "/api/agents") return okJson(agentsInUseFixture());
        if (url === "/api/agents/agent-1") return okJson(agentDetailFixture());
        throw new Error(`Unhandled URL ${url}`);
      });
    });

    it("renders name, description, configuration, and harness rows", async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText("Test Agent")).toBeInTheDocument());
      fireEvent.click(screen.getByText("Test Agent"));
      
      await waitFor(() => expect(screen.getByRole("heading", { name: "Test Agent Real Name" })).toBeInTheDocument());
      expect(screen.getByText("Detail description")).toBeInTheDocument();
      // Every frontmatter key we do not interpret is shown verbatim, not dropped.
      expect(screen.getByText("model")).toBeInTheDocument();
      expect(screen.getByText("sonnet")).toBeInTheDocument();
      expect(screen.getByText("permissionMode")).toBeInTheDocument();
      expect(screen.getByText("acceptEdits")).toBeInTheDocument();
      expect(screen.getByText("maxTurns")).toBeInTheDocument();
      expect(screen.getByText("hooks")).toBeInTheDocument();
      expect(screen.getByText("(1 entry)")).toBeInTheDocument();
      // name/description have their own sections and must not repeat here.
      expect(screen.queryByText("description")).not.toBeInTheDocument();
      expect(screen.getByText("Cursor")).toBeInTheDocument();
      expect(screen.getByText("Windsurf")).toBeInTheDocument();
    });

    it("renders unsupported harness row with disabled control showing detail", async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText("Test Agent")).toBeInTheDocument());
      fireEvent.click(screen.getByText("Test Agent"));
      
      await waitFor(() => expect(screen.getByText("Windsurf")).toBeInTheDocument());
      // Windsurf is unsupported, so there should be a span (not button) with "Enable" and opacity 0.5
      // UiTooltip is rendered
      const windsurfEnable = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'span' && element.className.includes("agent-detail__unsupported-pill") && content === "Enable";
      });
      expect(windsurfEnable).toBeInTheDocument();
    });

    it("toggles a harness from the detail view issues /agents/{ref}/enable", async () => {
      let capturedBody: any;
      fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url === "/api/agents") return okJson(agentsInUseFixture());
        if (url === "/api/agents/agent-1") return okJson(agentDetailFixture());
        if (url === "/api/agents/agent-1/enable") {
          capturedBody = JSON.parse(String(init?.body));
          return okJson({});
        }
        throw new Error(`Unhandled URL ${url}`);
      });

      renderPage();
      await waitFor(() => expect(screen.getByText("Test Agent")).toBeInTheDocument());
      fireEvent.click(screen.getByText("Test Agent"));
      
      await waitFor(() => expect(screen.getByText("Cursor")).toBeInTheDocument());
      const buttons = screen.getAllByRole("button", { name: "Enable" });
      const cursorButton = buttons.find(b => b.className.includes("action-pill--accent"))!;
      fireEvent.click(cursorButton);
      
      await waitFor(() => expect(capturedBody).toEqual({ harness: "cursor" }));
      expect(fetchMock.mock.calls.some(call => String(call[0]) === "/api/agents/agent-1/enable")).toBe(true);
    });

    it("opening the edit dialog prepopulates every field", async () => {
      renderPage();
      await waitFor(() => expect(screen.getByText("Test Agent")).toBeInTheDocument());
      fireEvent.click(screen.getByText("Test Agent"));
      
      await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument());
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));

      await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
      
      const nameInput = screen.getByLabelText(/Agent Name/i) as HTMLInputElement;
      await waitFor(() => expect(nameInput.value).toBe("Test Agent Real Name")); // not agent-1 slug

      const descInput = screen.getByLabelText(/Description/i) as HTMLTextAreaElement;
      expect(descInput.value).toBe("Detail description");

      const promptInput = screen.getByLabelText(/Prompt/i) as HTMLTextAreaElement;
      expect(promptInput.value).toBe("Test prompt");

      const toolsInput = screen.getByLabelText(/Tools/i) as HTMLInputElement;
      expect(toolsInput.value).toBe("tool1, tool2");
    });

    it("delete asks for confirmation before issuing DELETE", async () => {
      fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url === "/api/agents") return okJson(agentsInUseFixture());
        if (url === "/api/agents/agent-1") return okJson(agentDetailFixture());
        if (url === "/api/agents/agent-1" && init?.method === "DELETE") return okJson({});
        throw new Error(`Unhandled URL ${url}`);
      });

      renderPage();
      await waitFor(() => expect(screen.getByText("Test Agent")).toBeInTheDocument());
      fireEvent.click(screen.getByText("Test Agent"));
      
      await waitFor(() => expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument());
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));

      // confirm dialog appears
      await waitFor(() => expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument());
      const confirmDelete = screen.getByRole("button", { name: "Delete Agent" });
      fireEvent.click(confirmDelete);

      await waitFor(() => {
        const deletes = fetchMock.mock.calls.filter(c => String(c[0]) === "/api/agents/agent-1" && c[1]?.method === "DELETE");
        expect(deletes.length).toBe(1);
      });

      // The modal should be closed as part of the delete flow, so no error is shown
      await waitFor(() => {
        expect(screen.queryByRole("heading", { name: "Test Agent Real Name" })).not.toBeInTheDocument();
      });
      expect(screen.queryByText(/Failed to load agent/i)).not.toBeInTheDocument();
    });
  });
});
