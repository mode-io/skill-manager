import { describe, expect, it } from "vitest";

import { buildOverviewModel } from "./overview";

describe("capability overview model", () => {
  it("keeps CLIs as discover-only and local lifecycle rows for managed extensions", () => {
    const model = buildOverviewModel(
      {
        summary: { managed: 2, unmanaged: 1 },
        harnessColumns: [],
        rows: [],
      },
      {
        storePath: "/tmp/skill-manager/slash-commands/commands",
        syncStatePath: "/tmp/skill-manager/slash-commands/sync-state.json",
        targets: [],
        defaultTargets: [],
        commands: [
          {
            name: "code-review",
            description: "Review code",
            prompt: "$ARGUMENTS",
            syncTargets: [],
          },
        ],
        reviewCommands: [
          {
            reviewRef: "codex:missing-command:missing",
            kind: "missing",
            target: "codex",
            targetLabel: "Codex",
            name: "missing-command",
            path: "/tmp/home/.codex/prompts/missing-command.md",
            description: "Missing command",
            prompt: "",
            commandExists: true,
            canImport: false,
            actions: ["restore_managed", "remove_binding"],
            error: null,
          },
        ],
      },
      {
        columns: [],
        entries: [
          {
            name: "exa",
            displayName: "Exa",
            kind: "managed",
            spec: null,
            canEnable: true,
            enabledStatus: "disabled",
            availabilityStatus: "unavailable",
            mcpStatus: { kind: "unchecked", reason: null },
            installConfigStatus: { hasFields: false, missingRequired: [], configured: true },
            sightings: [],
          },
          {
            name: "firecrawl",
            displayName: "firecrawl",
            kind: "unmanaged",
            spec: null,
            canEnable: false,
            enabledStatus: "disabled",
            availabilityStatus: "unavailable",
            mcpStatus: {
              kind: "connection_issue",
              reason: "Skill Manager does not have a valid MCP spec for this server.",
            },
            installConfigStatus: { hasFields: false, missingRequired: [], configured: true },
            sightings: [],
          },
        ],
        issues: [],
      },
      null,
    );

    expect(model.extensions.map((entry) => entry.key)).toEqual(["skills", "slash-commands", "mcp", "hooks"]);
    expect(model.marketplaceEntries.map((entry) => entry.key)).toEqual(["skills", "mcp", "clis"]);
    expect(model.marketplaceEntries.find((entry) => entry.key === "clis")).toMatchObject({
      badge: "Preview only",
      action: { to: "/marketplace/clis" },
    });
    expect(model.stats.inUse.value).toBe(4);
    expect(model.stats.needsReview.value).toBe(3);
  });
});
