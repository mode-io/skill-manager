import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";

const fetchMock = vi.fn();

function renderApp(initialRoute = "/") {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App />
    </MemoryRouter>,
  );
}

function mockSkillsPage() {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url === "/skills") {
      return {
        ok: true,
        json: async () => ({
          summary: { managed: 1, foundLocally: 1, custom: 1, builtIn: 1 },
          harnessColumns: [{ harness: "codex", label: "Codex" }],
          rows: [
            {
              skillRef: "shared:shared-audit",
              name: "Shared Audit",
              description: "Shared audit workflow",
              displayStatus: "Managed",
              attentionMessage: null,
              needsAttention: false,
              defaultSortRank: 2,
              primaryAction: { kind: "open", label: "Open" },
              cells: [{ harness: "codex", label: "Codex", state: "disabled", interactive: true }],
            },
            {
              skillRef: "shared:audit-skill",
              name: "Audit Skill",
              description: "Custom audit workflow",
              displayStatus: "Custom",
              attentionMessage: "Modified locally; source updates are disabled.",
              needsAttention: true,
              defaultSortRank: 0,
              primaryAction: { kind: "open", label: "Open" },
              cells: [{ harness: "codex", label: "Codex", state: "enabled", interactive: true }],
            },
            {
              skillRef: "local:trace-lens",
              name: "Trace Lens",
              description: "Trace review workflow",
              displayStatus: "Found locally",
              attentionMessage: null,
              needsAttention: false,
              defaultSortRank: 1,
              primaryAction: { kind: "manage", label: "Bring under management" },
              cells: [{ harness: "codex", label: "Codex", state: "found", interactive: false }],
            },
            {
              skillRef: "builtin:scout",
              name: "Scout",
              description: "Built-in scouting workflow",
              displayStatus: "Built-in",
              attentionMessage: null,
              needsAttention: false,
              defaultSortRank: 3,
              primaryAction: { kind: "open", label: "Open" },
              cells: [{ harness: "codex", label: "Codex", state: "builtin", interactive: false }],
            },
          ],
        }),
      };
    }
    if (url.startsWith("/skills/")) {
      return {
        ok: true,
        json: async () => ({
          skillRef: "shared:shared-audit",
          name: "Shared Audit",
          description: "Shared audit workflow",
          displayStatus: "Managed",
          statusMessage: "Managed in the shared store and available for per-tool enable or disable.",
          attentionMessage: null,
          primaryAction: { kind: "open", label: "Open" },
          source: { kind: "github", label: "GitHub", locator: "github:mode-io/shared-audit" },
          actions: { canManage: false, canToggle: true, canUpdate: false, updateAvailable: null },
          harnesses: [{ harness: "codex", label: "Codex", state: "disabled", scopes: [], paths: [] }],
          locations: [],
          advanced: {
            packageDir: "shared-audit",
            packagePath: "/tmp/shared-audit",
            currentRevision: "abc",
            recordedRevision: "abc",
            sourceKind: "github",
            sourceLocator: "github:mode-io/shared-audit",
          },
        }),
      };
    }
    if (url.startsWith("/marketplace/popular")) {
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              id: "github:github:mode-io/shared-audit",
              name: "Shared Audit",
              description: "Shared audit workflow",
              sourceKind: "github",
              sourceLocator: "github:mode-io/shared-audit",
              registry: "skillssh",
              github: {
                repo: "mode-io/shared-audit",
                url: "https://github.com/mode-io/shared-audit",
                ownerLogin: "mode-io",
                avatarPath: "/marketplace/avatar?repo=mode-io%2Fshared-audit",
                stars: 33,
              },
            },
          ],
          nextOffset: null,
          hasMore: false,
        }),
      };
    }
    if (url === "/settings") {
      return {
        ok: true,
        json: async () => ({
          harnesses: [
            {
              harness: "codex",
              label: "Codex",
              detected: true,
              manageable: true,
              builtinSupport: false,
              issues: [],
              diagnostics: { discoveryMode: "filesystem", detectionDetails: [] },
            },
          ],
          storeIssues: [],
          bulkActions: { canManageAll: true },
        }),
      };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  });
}

describe("App routing", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("renders Skills page at /", async () => {
    mockSkillsPage();
    renderApp("/");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Managed skills" })).toBeInTheDocument();
    expect(screen.getByLabelText("Managed skills list")).toBeInTheDocument();
    expect(screen.getByText("Shared Audit")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search managed skills by name, description, or state")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Enable Shared Audit for Codex" })).toBeInTheDocument();
    expect(screen.getByText("Audit Skill")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bring all eligible skills under management" })).not.toBeInTheDocument();
  });

  it("renders the found-local intake page", async () => {
    mockSkillsPage();
    renderApp("/skills/found-local");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Found locally" })).toBeInTheDocument());
    expect(screen.getByLabelText("Found local skills list")).toBeInTheDocument();
    expect(screen.getByText("Trace Lens")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bring all eligible skills under management" })).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("renders Marketplace page at /marketplace", async () => {
    mockSkillsPage();
    renderApp("/marketplace");
    await waitFor(() => expect(screen.getByText("Popular skills")).toBeInTheDocument());
    expect(screen.getByText("Shared Audit")).toBeInTheDocument();
    expect(screen.getByAltText("Avatar for mode-io")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "mode-io/shared-audit" })).toBeInTheDocument();
  });

  it("opens the Settings drawer", async () => {
    mockSkillsPage();
    renderApp("/");
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument());
    expect(screen.getByText("Tools")).toBeInTheDocument();
  });
});
