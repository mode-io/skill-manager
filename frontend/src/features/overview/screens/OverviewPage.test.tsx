import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorJson, okJson } from "../../../test/fetch";
import { renderWithAppProviders } from "../../../test/render";
import OverviewPage from "./OverviewPage";

const fetchMock = vi.fn();

function renderOverview() {
  return renderWithAppProviders(<OverviewPage />, { route: "/overview" });
}

function skillsPayload() {
  return {
    summary: { managed: 2, unmanaged: 1 },
    harnessColumns: [
      { harness: "codex", label: "Codex", logoKey: "codex", installed: true },
      { harness: "claude", label: "Claude", logoKey: "claude", installed: true },
    ],
    rows: [
      {
        skillRef: "audit",
        name: "audit",
        description: "Audit project state.",
        displayStatus: "Managed",
        actions: {},
        cells: [
          { harness: "codex", label: "Codex", logoKey: "codex", state: "enabled", interactive: true },
          { harness: "claude", label: "Claude", logoKey: "claude", state: "disabled", interactive: true },
        ],
      },
      {
        skillRef: "docs",
        name: "docs",
        description: "Write documents.",
        displayStatus: "Managed",
        actions: {},
        cells: [
          { harness: "codex", label: "Codex", logoKey: "codex", state: "enabled", interactive: true },
          { harness: "claude", label: "Claude", logoKey: "claude", state: "enabled", interactive: true },
        ],
      },
      {
        skillRef: "trace",
        name: "trace",
        description: "Needs review.",
        displayStatus: "Unmanaged",
        actions: {},
        cells: [
          { harness: "codex", label: "Codex", logoKey: "codex", state: "found", interactive: false },
          { harness: "claude", label: "Claude", logoKey: "claude", state: "empty", interactive: false },
        ],
      },
    ],
  };
}

function mcpInventoryPayload() {
  return {
    columns: [
      {
        harness: "codex",
        label: "Codex",
        logoKey: "codex",
        installed: true,
        configPresent: true,
        mcpWritable: true,
        mcpUnavailableReason: null,
      },
      {
        harness: "claude",
        label: "Claude",
        logoKey: "claude",
        installed: true,
        configPresent: true,
        mcpWritable: false,
        mcpUnavailableReason: "Claude MCP writes are unavailable",
      },
    ],
    entries: [
      {
        name: "exa",
        displayName: "Exa",
        kind: "managed",
        canEnable: true,
        spec: { transport: "http", url: "https://example.com/mcp" },
        sightings: [
          { harness: "codex", state: "managed", driftDetail: null },
          { harness: "claude", state: "drifted", driftDetail: "Different headers" },
        ],
      },
      {
        name: "context7",
        displayName: "Context7",
        kind: "managed",
        canEnable: true,
        spec: { transport: "stdio", command: "npx", args: ["context7"] },
        sightings: [{ harness: "codex", state: "managed", driftDetail: null }],
      },
      {
        name: "firecrawl",
        displayName: "Firecrawl",
        kind: "unmanaged",
        canEnable: false,
        spec: null,
        sightings: [{ harness: "claude", state: "unmanaged", driftDetail: null }],
      },
    ],
    issues: [{ name: "bad", reason: "Invalid manifest" }],
  };
}

function stubOverviewApi({
  skills = skillsPayload(),
  mcp = mcpInventoryPayload(),
}: {
  skills?: unknown;
  mcp?: unknown;
} = {}) {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url === "/api/skills") return skills instanceof Error ? errorJson(skills.message) : okJson(skills);
    if (url === "/api/mcp/servers") return mcp instanceof Error ? errorJson(mcp.message) : okJson(mcp);
    return okJson({});
  });
}

function section(name: string): HTMLElement {
  return screen.getByRole("heading", { name }).closest("section") as HTMLElement;
}

function removedOverviewCopy(): string[] {
  return [
    ["at a", "glance"].join(" "),
    ["Manage", "by", "function"].join(" "),
    ["Capability", "portfolio"].join(" "),
    ["Review", "queue"].join(" "),
    ["Harness", "coverage"].join(" "),
    ["Each", "capability"].join(" "),
    ["Server", "configs", "Skill", "Manager"].join(" "),
    ["Preview-only", "discovery"].join(" "),
    "Skills and MCP servers in the catalog",
    "Observed destinations across skills and MCP",
  ];
}

function removedMarketplaceFacts(): string[] {
  return [
    ["Installable", "skills"].join(" "),
    ["Source", "install"].join(" "),
    ["External", "tools"].join(" "),
  ];
}

describe("OverviewPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("renders the portfolio statistics band", async () => {
    stubOverviewApi();
    renderOverview();

    const stats = await screen.findByLabelText("Inventory statistics");
    expect(within(stats).getByText("In use")).toBeInTheDocument();
    expect(within(stats).getAllByText("Needs review")).toHaveLength(1);
    expect(within(stats).getByText("Harnesses")).toBeInTheDocument();
    await within(stats).findByText("2 skills · 2 MCP");
    expect(within(stats).getByText("adoption · config · inventory")).toBeInTheDocument();
    expect(within(stats).getByText("2 observed")).toBeInTheDocument();
    expect(screen.queryByText(["skill-manager", "status"].join(" "))).not.toBeInTheDocument();
    for (const copy of removedOverviewCopy()) {
      expect(screen.queryByText(copy, { exact: false })).not.toBeInTheDocument();
    }
  });

  it("links each extension to its in-use and needs-review surfaces", async () => {
    stubOverviewApi();
    renderOverview();

    const extensions = await screen.findByRole("heading", { name: "Extensions" });
    expect(extensions).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: ["Manage", "by", "function"].join(" ") })).not.toBeInTheDocument();

    const skillsCard = screen.getByRole("heading", { name: "Skills" }).closest("article") as HTMLElement;
    await waitFor(() => expect(within(skillsCard).getByText("2 in use")).toBeInTheDocument());
    expect(within(skillsCard).getByText("1 review")).toBeInTheDocument();
    expect(within(skillsCard).getByRole("link", { name: "In use" })).toHaveAttribute("href", "/skills/use");
    expect(within(skillsCard).getByRole("link", { name: "Needs review" })).toHaveAttribute("href", "/skills/review");
    expect(within(skillsCard).queryByRole("link", { name: "Marketplace" })).not.toBeInTheDocument();

    const mcpCard = screen.getByRole("heading", { name: "MCP Servers" }).closest("article") as HTMLElement;
    expect(within(mcpCard).getByText("2 in use")).toBeInTheDocument();
    expect(within(mcpCard).getByText("4 review")).toBeInTheDocument();
    expect(within(mcpCard).getByRole("link", { name: "In use" })).toHaveAttribute("href", "/mcp/use");
    expect(within(mcpCard).getByRole("link", { name: "Needs review" })).toHaveAttribute("href", "/mcp/review");
    expect(within(mcpCard).queryByRole("link", { name: "Marketplace" })).not.toBeInTheDocument();

    const extensionsSection = section("Extensions");
    expect(within(extensionsSection).queryByRole("heading", { name: "CLIs" })).not.toBeInTheDocument();
  });

  it("renders marketplace discovery rows after extensions", async () => {
    stubOverviewApi();
    renderOverview();

    const extensions = await screen.findByRole("heading", { name: "Extensions" });
    const marketplace = screen.getByRole("heading", { name: "Discover" });
    expect(extensions.compareDocumentPosition(marketplace) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const primaryColumn = extensions.closest(".overview-dashboard-column--primary");
    const secondaryColumn = marketplace.closest(".overview-dashboard-column--secondary");
    expect(primaryColumn).not.toBeNull();
    expect(secondaryColumn).not.toBeNull();
    expect(primaryColumn).toContainElement(screen.getByRole("heading", { name: "Active harnesses" }).closest("section"));
    expect(secondaryColumn).toContainElement(screen.getByRole("heading", { name: "Review" }).closest("section"));

    const marketplaceSection = section("Discover");
    const skillsRow = within(marketplaceSection).getByRole("heading", { name: "Skills Marketplace" }).closest("article") as HTMLElement;
    expect(within(skillsRow).getByText("skills.sh")).toBeInTheDocument();
    expect(within(skillsRow).getByRole("link", { name: "Browse" })).toHaveAttribute("href", "/marketplace/skills");

    const mcpRow = within(marketplaceSection).getByRole("heading", { name: "MCP Marketplace" }).closest("article") as HTMLElement;
    expect(within(mcpRow).getByText("smithery.ai")).toBeInTheDocument();
    expect(within(mcpRow).getByRole("link", { name: "Browse" })).toHaveAttribute("href", "/marketplace/mcp");

    const cliRow = within(marketplaceSection).getByRole("heading", { name: "CLI Marketplace" }).closest("article") as HTMLElement;
    expect(within(cliRow).getByText("CLIs.dev")).toBeInTheDocument();
    expect(within(cliRow).getByText("Preview only")).toBeInTheDocument();
    expect(within(cliRow).getByRole("link", { name: "Browse" })).toHaveAttribute("href", "/marketplace/clis");
    for (const removedText of removedMarketplaceFacts()) {
      expect(screen.queryByText(removedText)).not.toBeInTheDocument();
    }
  });

  it("shows only non-zero review queue items", async () => {
    stubOverviewApi({
      skills: { ...skillsPayload(), summary: { managed: 2, unmanaged: 0 } },
    });
    renderOverview();

    await waitFor(() =>
      expect(screen.getByRole("link", { name: /MCP configs to review/i })).toBeInTheDocument(),
    );
    const queue = section("Review");
    expect(within(queue).queryByRole("link", { name: /Skills to review/i })).not.toBeInTheDocument();
    expect(within(queue).getByRole("link", { name: /MCP configs to review/i })).toBeInTheDocument();
    expect(within(queue).getByRole("link", { name: /Different MCP configs/i })).toBeInTheDocument();
    expect(within(queue).getByRole("link", { name: /MCP inventory issues/i })).toBeInTheDocument();
    expect(within(queue).getByRole("link", { name: /MCP harness unavailable/i })).toBeInTheDocument();
  });

  it("renders compact harness coverage rows with skill, MCP, and different-config counts", async () => {
    stubOverviewApi();
    renderOverview();

    await waitFor(() => expect(screen.getByText("Codex")).toBeInTheDocument());
    const coverage = section("Active harnesses");
    const codexRow = within(coverage).getByText("Codex").closest(".overview-coverage-row") as HTMLElement;
    const claudeRow = within(coverage).getByText("Claude").closest(".overview-coverage-row") as HTMLElement;

    expect(within(coverage).queryByText("Different")).not.toBeInTheDocument();
    expect(within(coverage).queryByText("Status")).not.toBeInTheDocument();
    expect(within(coverage).getByText("Needs review")).toBeInTheDocument();
    expect(within(codexRow).getAllByText("2")).toHaveLength(2);
    expect(within(codexRow).getByText("1")).toBeInTheDocument();
    expect(within(claudeRow).getByText("1 different")).toBeInTheDocument();
    expect(within(claudeRow).getByLabelText("Claude MCP writes are unavailable")).toBeInTheDocument();
  });

  it("keeps usable MCP data visible when skills fail", async () => {
    stubOverviewApi({
      skills: new Error("Skills unavailable"),
      mcp: {
        columns: [],
        entries: [
          {
            name: "exa",
            displayName: "Exa",
            kind: "managed",
            canEnable: true,
            spec: null,
            sightings: [],
          },
        ],
        issues: [],
      },
    });
    renderOverview();

    await waitFor(() =>
      expect(screen.getByText("Unable to load skills: Skills unavailable")).toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { name: "Extensions" })).toBeInTheDocument();
    expect(screen.queryByText("Unable to load overview data.")).not.toBeInTheDocument();
  });
});
