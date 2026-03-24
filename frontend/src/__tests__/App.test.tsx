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
          summary: { managed: 1, foundLocally: 1, custom: 0, builtIn: 0, needsAction: 1 },
          harnessColumns: [{ harness: "codex", label: "Codex" }],
          rows: [
            {
              skillRef: "shared:shared-audit",
              name: "Shared Audit",
              description: "Shared audit workflow",
              displayStatus: "Managed",
              attentionMessage: null,
              primaryAction: { kind: "open", label: "Open" },
              isBuiltin: false,
              cells: [{ harness: "codex", label: "Codex", state: "disabled", interactive: true }],
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
    if (url === "/marketplace/popular") {
      return {
        ok: true,
        json: async () => [
          {
            id: "github:github:mode-io/shared-audit",
            name: "Shared Audit",
            description: "Shared audit workflow",
            sourceKind: "github",
            sourceLocator: "github:mode-io/shared-audit",
            registry: "skillssh",
            installs: 12,
            githubRepo: "mode-io/shared-audit",
            githubStars: 33,
            badge: "Official",
            popularity: 33,
          },
        ],
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
    expect(screen.getByText("Shared Audit")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bring all eligible skills under management" })).toBeInTheDocument();
  });

  it("renders Marketplace page at /marketplace", async () => {
    mockSkillsPage();
    renderApp("/marketplace");
    await waitFor(() => expect(screen.getByText("Popular skills")).toBeInTheDocument());
    expect(screen.getByText("Shared Audit")).toBeInTheDocument();
  });

  it("opens the Settings drawer", async () => {
    mockSkillsPage();
    renderApp("/");
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument());
    expect(screen.getByText("Tools")).toBeInTheDocument();
  });
});
