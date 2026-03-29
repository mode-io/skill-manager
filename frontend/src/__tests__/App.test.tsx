import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function stubDesktopMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function mockSkillsPage() {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url === "/api/skills") {
      return {
        ok: true,
        json: async () => ({
          summary: { managed: 1, unmanaged: 1, custom: 1, builtIn: 1 },
          harnessColumns: [{ harness: "codex", label: "Codex" }],
          rows: [
            {
              skillRef: "shared:shared-audit",
              name: "Shared Audit",
              description: "Shared audit workflow",
              displayStatus: "Managed",
              attentionMessage: null,
              primaryAction: { kind: "open", label: "Open" },
              cells: [{ harness: "codex", label: "Codex", state: "disabled", interactive: true }],
            },
            {
              skillRef: "shared:audit-skill",
              name: "Audit Skill",
              description: "Custom audit workflow",
              displayStatus: "Custom",
              attentionMessage: "Modified locally; source updates are disabled.",
              primaryAction: { kind: "open", label: "Open" },
              cells: [{ harness: "codex", label: "Codex", state: "enabled", interactive: true }],
            },
            {
              skillRef: "unmanaged:trace-lens",
              name: "Trace Lens",
              description: "Trace review workflow",
              displayStatus: "Unmanaged",
              attentionMessage: null,
              primaryAction: { kind: "manage", label: "Bring under management" },
              cells: [{ harness: "codex", label: "Codex", state: "found", interactive: false }],
            },
            {
              skillRef: "builtin:scout",
              name: "Scout",
              description: "Built-in scouting workflow",
              displayStatus: "Built-in",
              attentionMessage: null,
              primaryAction: { kind: "open", label: "Open" },
              cells: [{ harness: "codex", label: "Codex", state: "builtin", interactive: false }],
            },
          ],
        }),
      };
    }
    if (url.startsWith("/api/skills/")) {
      return {
        ok: true,
        json: async () => ({
          skillRef: "shared:shared-audit",
          name: "Shared Audit",
          description: "Shared audit workflow",
          displayStatus: "Managed",
          attentionMessage: null,
          actions: { canManage: false, canUpdate: false, updateAvailable: null },
          locations: [
            {
              kind: "shared",
              harness: null,
              label: "Shared Store",
              scope: null,
              path: "/tmp/shared-audit",
              revision: "abc",
              sourceKind: "github",
              sourceLocator: "github:mode-io/shared-audit",
              detail: null,
            },
            {
              kind: "harness",
              harness: "codex",
              label: "Codex",
              scope: "user",
              path: "/tmp/home/.codex/skills/shared-audit",
              revision: "abc",
              sourceKind: "github",
              sourceLocator: "github:mode-io/shared-audit",
              detail: null,
            },
          ],
          advanced: {
            packageDir: "shared-audit",
            packagePath: "/tmp/shared-audit",
            currentRevision: "abc",
            recordedRevision: "abc",
            sourceKind: "github",
            sourceLocator: "github:mode-io/shared-audit",
          },
          documentMarkdown: "# Shared Audit\n\n## Use when\n\nRun the shared audit workflow.\n",
        }),
      };
    }
    if (url.startsWith("/api/marketplace/popular")) {
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              id: "skillssh:mode-io/shared-audit:shared-audit",
              name: "Shared Audit",
              description: "Shared audit workflow",
              installs: 44,
              stars: 33,
              repoLabel: "mode-io/shared-audit",
              repoImageUrl: "https://avatars.githubusercontent.com/u/424242?v=4",
              githubFolderUrl: "https://github.com/mode-io/shared-audit/tree/main/shared-audit",
              skillsDetailUrl: "https://skills.sh/mode-io/shared-audit/shared-audit",
              installToken: "token-shared-audit",
            },
          ],
          nextOffset: null,
          hasMore: false,
        }),
      };
    }
    if (url === "/api/settings") {
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
    stubDesktopMatchMedia();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("renders Skills page at /", async () => {
    mockSkillsPage();
    renderApp("/");
    await waitFor(() => expect(screen.getByLabelText("Managed skills list")).toBeInTheDocument());
    expect(document.querySelector(".app-main")).toHaveClass("app-main--skills");
    expect(screen.getByRole("heading", { name: "Managed skills" })).toBeInTheDocument();
    expect(screen.getByLabelText("Managed skills list")).toBeInTheDocument();
    expect(screen.getByText("Shared Audit")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search managed skills by name, description, or state")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Enable Shared Audit for Codex" })).toBeInTheDocument();
    expect(screen.getByText("Audit Skill")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Built-in skills" })).toBeInTheDocument();
    expect(screen.getByText("Scout")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bring all eligible skills under management" })).not.toBeInTheDocument();
  });

  it("renders the unmanaged intake page", async () => {
    mockSkillsPage();
    renderApp("/skills/unmanaged");
    await waitFor(() => expect(screen.getByLabelText("Unmanaged skills list")).toBeInTheDocument());
    expect(screen.getByLabelText("Unmanaged skills list")).toBeInTheDocument();
    expect(screen.getByText("Trace Lens")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Unmanaged skills" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Unmanaged/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bring all eligible skills under management" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What happens when you manage all eligible skills" })).toBeInTheDocument();
    expect(
      screen.queryByText("Review skills discovered in local tool folders and bring the ones you want into the shared managed store."),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("shows the bulk-manage help popover on the unmanaged page", async () => {
    mockSkillsPage();
    renderApp("/skills/unmanaged");

    await waitFor(() => expect(screen.getByLabelText("Unmanaged skills list")).toBeInTheDocument());

    fireEvent.mouseEnter(screen.getByRole("button", { name: "What happens when you manage all eligible skills" }));

    await waitFor(() => expect(screen.getByText("Bulk manage")).toBeInTheDocument());
    expect(
      screen.getByText("Moves local copies into the Shared Store, then replaces tool-folder copies with managed links."),
    ).toBeInTheDocument();
  });

  it("renders Marketplace page at /marketplace", async () => {
    mockSkillsPage();
    renderApp("/marketplace");
    await waitFor(() => expect(screen.getByText("Shared Audit")).toBeInTheDocument());
    expect(document.querySelector(".app-main")).not.toHaveClass("app-main--skills");
    expect(screen.getByText("All-time leaderboard")).toBeInTheDocument();
    expect(screen.getByAltText("Avatar for mode-io/shared-audit")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "mode-io/shared-audit" })).toBeInTheDocument();
  });

  it("opens the Settings popover", async () => {
    mockSkillsPage();
    renderApp("/");
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    await waitFor(() => expect(screen.getByText("Tools")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Tools")).toBeInTheDocument();
  });

  it("reuses the cached skills workspace and preserves managed search when returning from marketplace", async () => {
    mockSkillsPage();
    renderApp("/skills/managed");

    await waitFor(() => expect(screen.getByLabelText("Search managed skills")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Search managed skills"), {
      target: { value: "Audit" },
    });

    fireEvent.click(screen.getByRole("link", { name: "Marketplace" }));
    await waitFor(() => expect(screen.getByText("All-time leaderboard")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("link", { name: "Skills" }));
    await waitFor(() => expect(screen.getByLabelText("Search managed skills")).toBeInTheDocument());

    expect(screen.getByDisplayValue("Audit")).toBeInTheDocument();
    expect(screen.queryByText("Loading managed skills")).not.toBeInTheDocument();

    const skillListRequests = fetchMock.mock.calls.filter(([input]) => {
      const url = typeof input === "string" ? input : input.toString();
      return url === "/api/skills";
    });
    expect(skillListRequests).toHaveLength(1);
  });

  it("opens the inline detail panel from the skills URL query param", async () => {
    mockSkillsPage();
    const scrollSpy = vi.fn();
    Object.defineProperty(window, "scrollTo", {
      writable: true,
      configurable: true,
      value: scrollSpy,
    });
    renderApp("/skills/managed?skill=shared:shared-audit");

    await waitFor(() => expect(screen.getByLabelText("Skill details panel")).toBeInTheDocument());
    await waitFor(() =>
      expect(
        screen.getByText("Run the shared audit workflow."),
      ).toBeInTheDocument(),
    );
    const panel = screen.getByLabelText("Skill details panel");
    expect(within(panel).getByRole("button", { name: /SKILL\.md/i })).toHaveAttribute("aria-expanded", "true");
    expect(within(panel).getByRole("button", { name: /Advanced details/i })).toHaveAttribute("aria-expanded", "false");
    expect(within(panel).queryByRole("switch")).not.toBeInTheDocument();
    expect(within(panel).queryByText("Source")).not.toBeInTheDocument();
    expect(within(panel).queryByText("Overview")).not.toBeInTheDocument();
    expect(within(panel).getByText("Shared Store is the canonical physical package. Tool locations are symlinks to it when enabled.")).toBeInTheDocument();
    expect(within(panel).getByText("Canonical physical package")).toBeInTheDocument();
    expect(within(panel).getByText("Symlink to Shared Store")).toBeInTheDocument();
    const panelText = panel.textContent ?? "";
    expect(panelText.indexOf("Shared Store")).toBeLessThan(panelText.indexOf("Codex"));
    expect(screen.queryByLabelText("Skill details drawer")).not.toBeInTheDocument();
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("does not auto-scroll the window on desktop user selection", async () => {
    mockSkillsPage();
    const scrollSpy = vi.fn();
    Object.defineProperty(window, "scrollTo", {
      writable: true,
      configurable: true,
      value: scrollSpy,
    });

    renderApp("/skills/managed");
    await waitFor(() => expect(screen.getByLabelText("Managed skills list")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Shared audit workflow"));
    await waitFor(() => expect(screen.getByLabelText("Skill details panel")).toBeInTheDocument());
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("closes the inline detail panel when the selected card is clicked again", async () => {
    mockSkillsPage();
    renderApp("/skills/managed");

    await waitFor(() => expect(screen.getByLabelText("Managed skills list")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Shared audit workflow"));
    await waitFor(() =>
      expect(screen.getByLabelText("Skill details panel")).toHaveAttribute("aria-hidden", "false"),
    );

    fireEvent.click(screen.getByText("Shared audit workflow"));
    await waitFor(() =>
      expect(screen.getByLabelText("Skill details panel")).toHaveAttribute("aria-hidden", "true"),
    );
  });
});
