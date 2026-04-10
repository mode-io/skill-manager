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

function mockSkillsPage(options?: { codexSupportEnabled?: boolean }) {
  let sharedAuditState: "managed" | "unmanaged" | "deleted" = "managed";
  let codexSupportEnabled = options?.codexSupportEnabled ?? true;

  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url === "/api/skills") {
      return {
        ok: true,
        json: async () => ({
          summary: {
            managed: sharedAuditState === "managed" ? 1 : 0,
            unmanaged: sharedAuditState === "unmanaged" ? 2 : 1,
            custom: 1,
            builtIn: 1,
          },
          harnessColumns: codexSupportEnabled ? [{ harness: "codex", label: "Codex", logoKey: "codex" }] : [],
          rows: [
            ...(sharedAuditState === "managed" ? [{
              skillRef: "shared:shared-audit",
              name: "Shared Audit",
              description: "Shared audit workflow",
              displayStatus: "Managed",
              attentionMessage: null,
              actions: { canManage: false },
              cells: codexSupportEnabled ? [{ harness: "codex", label: "Codex", logoKey: "codex", state: "disabled", interactive: true }] : [],
            }] : []),
            ...(sharedAuditState === "unmanaged" ? [{
              skillRef: "unmanaged:shared-audit-restored",
              name: "Shared Audit",
              description: "Shared audit workflow",
              displayStatus: "Unmanaged",
              attentionMessage: null,
              actions: { canManage: true },
              cells: codexSupportEnabled ? [{ harness: "codex", label: "Codex", logoKey: "codex", state: "found", interactive: false }] : [],
            }] : []),
            {
              skillRef: "shared:audit-skill",
              name: "Audit Skill",
              description: "Custom audit workflow",
              displayStatus: "Custom",
              attentionMessage: "Modified locally; source updates are disabled.",
              actions: { canManage: false },
              cells: codexSupportEnabled ? [{ harness: "codex", label: "Codex", logoKey: "codex", state: "enabled", interactive: true }] : [],
            },
            {
              skillRef: "unmanaged:trace-lens",
              name: "Trace Lens",
              description: "Trace review workflow",
              displayStatus: "Unmanaged",
              attentionMessage: null,
              actions: { canManage: true },
              cells: codexSupportEnabled ? [{ harness: "codex", label: "Codex", logoKey: "codex", state: "found", interactive: false }] : [],
            },
            {
              skillRef: "builtin:review-helper",
              name: "Review Helper",
              description: "Bundled with OpenCode",
              displayStatus: "Built-in",
              attentionMessage: null,
              actions: { canManage: false },
              cells: [{ harness: "opencode", label: "OpenCode", state: "builtin", interactive: false }],
            },
          ],
        }),
      };
    }
    if (url === "/api/skills/shared%3Ashared-audit/delete") {
      sharedAuditState = "deleted";
      return {
        ok: true,
        json: async () => ({ ok: true }),
      };
    }
    if (url === "/api/skills/shared%3Ashared-audit/unmanage") {
      sharedAuditState = "unmanaged";
      return {
        ok: true,
        json: async () => ({ ok: true }),
      };
    }
    if (url === "/api/skills/shared%3Ashared-audit/source-status") {
      return {
        ok: true,
        json: async () => ({ updateStatus: "no_update_available" }),
      };
    }
    if (url.startsWith("/api/skills/")) {
      if (sharedAuditState !== "managed" && url === "/api/skills/shared%3Ashared-audit") {
        return {
          ok: false,
          status: 404,
          statusText: "Not Found",
          json: async () => ({ error: "unknown skill ref: shared:shared-audit" }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          skillRef: "shared:shared-audit",
          name: "Shared Audit",
          description: "Shared audit workflow",
          displayStatus: "Managed",
          attentionMessage: null,
          actions: {
            canManage: false,
            stopManagingStatus: "available",
            stopManagingHarnessLabels: ["Codex"],
            canDelete: true,
            deleteHarnessLabels: ["Codex"],
          },
          harnessCells: [
            { harness: "codex", label: "Codex", state: "disabled", interactive: true },
            { harness: "claude", label: "Claude", state: "disabled", interactive: true },
            { harness: "cursor", label: "Cursor", state: "disabled", interactive: true },
            { harness: "opencode", label: "OpenCode", state: "disabled", interactive: true },
            { harness: "openclaw", label: "OpenClaw", state: "disabled", interactive: true },
          ],
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
          sourceLinks: {
            repoLabel: "mode-io/shared-audit",
            repoUrl: "https://github.com/mode-io/shared-audit",
            folderUrl: "https://github.com/mode-io/shared-audit/tree/main/shared-audit",
          },
          documentMarkdown: "# Shared Audit\n\n## Use when\n\nRun the shared audit workflow.\n",
        }),
      };
    }
    if (url === "/api/marketplace/items/skillssh%3Amode-io%2Fshared-audit%3Ashared-audit/document") {
      return {
        ok: true,
        json: async () => ({
          status: "ready",
          documentMarkdown: "# Shared Audit",
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
              installation: {
                status: "installable",
                installedSkillRef: null,
              },
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
              logoKey: "codex",
              supportEnabled: codexSupportEnabled,
              detected: true,
              managedLocation: "/tmp/home/.codex/skills",
            },
          ],
        }),
      };
    }
    if (url === "/api/settings/harnesses/codex/support") {
      const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : null;
      codexSupportEnabled = body?.enabled ?? codexSupportEnabled;
      return {
        ok: true,
        json: async () => ({ ok: true, enabled: codexSupportEnabled }),
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
    expect(screen.getByText("Review Helper")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bring All Eligible Skills Under Management" })).not.toBeInTheDocument();
  });

  it("renders the unmanaged intake page", async () => {
    mockSkillsPage();
    renderApp("/skills/unmanaged");
    await waitFor(() => expect(screen.getByLabelText("Unmanaged skills list")).toBeInTheDocument());
    expect(screen.getByLabelText("Unmanaged skills list")).toBeInTheDocument();
    expect(screen.getByText("Trace Lens")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Unmanaged skills" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Unmanaged/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bring All Eligible Skills Under Management" })).toBeInTheDocument();
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

    await waitFor(() => expect(screen.getByText("Bulk Manage")).toBeInTheDocument());
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

  it("shows the manual refresh spinner inside the header button only", async () => {
    const pendingRefresh = deferred<{
      ok: boolean;
      json: () => Promise<object>;
    }>();
    let skillsRequestCount = 0;

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/skills") {
        skillsRequestCount += 1;
        if (skillsRequestCount === 1) {
          return {
            ok: true,
            json: async () => ({
              summary: { managed: 1, unmanaged: 0, custom: 0, builtIn: 0 },
              harnessColumns: [{ harness: "codex", label: "Codex", logoKey: "codex" }],
              rows: [{
                skillRef: "shared:shared-audit",
                name: "Shared Audit",
                description: "Shared audit workflow",
                displayStatus: "Managed",
                attentionMessage: null,
                actions: { canManage: false },
                cells: [{ harness: "codex", label: "Codex", logoKey: "codex", state: "enabled", interactive: true }],
              }],
            }),
          };
        }
        return pendingRefresh.promise;
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderApp("/");

    await waitFor(() => expect(screen.getByText("Shared Audit")).toBeInTheDocument());

    const refreshButton = screen.getByRole("button", { name: "Refresh Data" });
    fireEvent.click(refreshButton);

    await waitFor(() => expect(refreshButton).toHaveAttribute("aria-busy", "true"));
    expect(refreshButton).toBeDisabled();
    expect(within(refreshButton).getByRole("status", { name: "Refreshing data" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Refreshing skills")).not.toBeInTheDocument();

    pendingRefresh.resolve({
      ok: true,
      json: async () => ({
        summary: { managed: 1, unmanaged: 0, custom: 0, builtIn: 0 },
        harnessColumns: [{ harness: "codex", label: "Codex", logoKey: "codex" }],
        rows: [{
          skillRef: "shared:shared-audit",
          name: "Shared Audit",
          description: "Shared audit workflow",
          displayStatus: "Managed",
          attentionMessage: null,
          actions: { canManage: false },
          cells: [{ harness: "codex", label: "Codex", logoKey: "codex", state: "enabled", interactive: true }],
        }],
      }),
    });

    await waitFor(() => expect(refreshButton).not.toBeDisabled());
    expect(screen.getByRole("button", { name: "Refresh Data" })).toBeInTheDocument();
  });

  it("navigates to the Settings page", async () => {
    mockSkillsPage();
    renderApp("/");
    fireEvent.click(screen.getByRole("link", { name: "Open settings" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Harnesses" })).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Harnesses" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Enable Codex support" })).toBeInTheDocument();
    expect(screen.getByText("/tmp/home/.codex/skills")).toBeInTheDocument();
    expect(screen.queryByText("Support toggles are non-destructive.")).not.toBeInTheDocument();
    expect(screen.queryByText("Ready for skill discovery and management on this computer.")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Store Network" })).not.toBeInTheDocument();
    expect(screen.queryByText("filesystem")).not.toBeInTheDocument();
  });

  it("shows the enabled-state harness support tooltip on toggle focus", async () => {
    mockSkillsPage();
    renderApp("/settings");

    const codexSwitch = await screen.findByRole("switch", { name: "Enable Codex support" });
    fireEvent.focus(codexSwitch);

    expect(
      screen.getByText("Turn off to make skill-manager ignore this harness. Your local files stay unchanged."),
    ).toBeInTheDocument();
  });

  it("shows the disabled-state harness support tooltip on toggle focus", async () => {
    mockSkillsPage({ codexSupportEnabled: false });
    renderApp("/settings");

    const codexSwitch = await screen.findByRole("switch", { name: "Enable Codex support" });
    fireEvent.focus(codexSwitch);

    expect(
      screen.getByText("Turn on to let skill-manager discover and manage skills for this harness. Nothing is moved or deleted."),
    ).toBeInTheDocument();
  });

  it("clears settings toggle pending state after a successful support update", async () => {
    mockSkillsPage();
    renderApp("/settings");

    const codexSwitch = await screen.findByRole("switch", { name: "Enable Codex support" });
    fireEvent.click(codexSwitch);

    await waitFor(() => expect(codexSwitch).not.toBeDisabled());
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
    expect(within(panel).getByText("Source")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: /mode-io\/shared-audit/i })).toHaveAttribute("href", "https://github.com/mode-io/shared-audit");
    expect(within(panel).getByRole("link", { name: /Open skill folder/i })).toHaveAttribute("href", "https://github.com/mode-io/shared-audit/tree/main/shared-audit");
    expect(within(panel).getByText("No Update Available")).toBeInTheDocument();
    expect(within(panel).getByText("Harness access")).toBeInTheDocument();
    expect(within(panel).getByRole("switch", { name: "Enable Shared Audit for Codex" })).toBeInTheDocument();
    expect(within(panel).getByRole("switch", { name: "Enable Shared Audit for Claude" })).toBeInTheDocument();
    expect(within(panel).getByRole("switch", { name: "Enable Shared Audit for Cursor" })).toBeInTheDocument();
    expect(within(panel).getByRole("switch", { name: "Enable Shared Audit for OpenCode" })).toBeInTheDocument();
    expect(within(panel).getByRole("switch", { name: "Enable Shared Audit for OpenClaw" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Stop Managing" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Delete Skill" })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /Advanced details/i })).not.toBeInTheDocument();
    expect(within(panel).queryByText("Overview")).not.toBeInTheDocument();
    expect(within(panel).getByText("Shared Store is the canonical physical package. Tool locations are symlinks to it when enabled.")).toBeInTheDocument();
    expect(within(panel).getByText("Canonical physical package")).toBeInTheDocument();
    expect(within(panel).getByText("Symlink to Shared Store")).toBeInTheDocument();
    expect(screen.queryByLabelText("Skill details drawer")).not.toBeInTheDocument();
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("routes detail-panel harness toggles through the enable mutation endpoint", async () => {
    mockSkillsPage();
    renderApp("/skills/managed?skill=shared:shared-audit");

    const panel = await screen.findByLabelText("Skill details panel");
    await waitFor(() => expect(within(panel).getByText("Harness access")).toBeInTheDocument());
    const toggle = within(panel).getByRole("switch", { name: "Enable Shared Audit for Codex" });

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          const url = typeof input === "string" ? input : input.toString();
          return url === "/api/skills/shared%3Ashared-audit/enable" && init?.method === "POST";
        }),
      ).toBe(true),
    );
  });

  it("confirms destructive delete from the detail panel and removes the skill", async () => {
    mockSkillsPage();
    renderApp("/skills/managed?skill=shared:shared-audit");

    const panel = await screen.findByLabelText("Skill details panel");
    const deleteButton = await within(panel).findByRole("button", { name: "Delete Skill" });
    fireEvent.click(deleteButton);

    const dialog = await screen.findByRole("dialog", { name: "Delete managed skill?" });
    expect(within(dialog).getByText("Affected harnesses: Codex")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Still Delete" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Still Delete" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          const url = typeof input === "string" ? input : input.toString();
          return url === "/api/skills/shared%3Ashared-audit/delete" && init?.method === "POST";
        }),
      ).toBe(true),
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Skill details panel")).toHaveAttribute("aria-hidden", "true"),
    );
    expect(within(screen.getByLabelText("Managed skills list")).queryByText("Shared Audit")).not.toBeInTheDocument();
  });

  it("shows stop-managing help and moves the skill back to unmanaged", async () => {
    mockSkillsPage();
    renderApp("/skills/managed?skill=shared:shared-audit");

    const panel = await screen.findByLabelText("Skill details panel");
    const stopManagingButton = await within(panel).findByRole("button", { name: "Stop Managing" });

    fireEvent.mouseEnter(stopManagingButton);

    await waitFor(() => expect(screen.getByText("Moves this skill out of the shared managed store and restores local copies only for the harnesses that are currently enabled.")).toBeInTheDocument());

    fireEvent.click(stopManagingButton);

    const dialog = await screen.findByRole("dialog", { name: "Move skill back to unmanaged?" });
    expect(within(dialog).getByText("Will restore to: Codex")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Stop Managing" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Stop Managing" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input, init]) => {
          const url = typeof input === "string" ? input : input.toString();
          return url === "/api/skills/shared%3Ashared-audit/unmanage" && init?.method === "POST";
        }),
      ).toBe(true),
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Skill details panel")).toHaveAttribute("aria-hidden", "true"),
    );
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
