import { describe, expect, it } from "vitest";

import { buildOverviewModel } from "./overview";

describe("capability overview model", () => {
  it("keeps CLIs as discover-only and local lifecycle rows for Skills/MCP", () => {
    const model = buildOverviewModel(
      {
        summary: { managed: 2, unmanaged: 1 },
        harnessColumns: [],
        rows: [],
      },
      {
        columns: [],
        entries: [
          { name: "exa", displayName: "Exa", kind: "managed", spec: null, canEnable: true, sightings: [] },
          { name: "firecrawl", displayName: "firecrawl", kind: "unmanaged", spec: null, canEnable: false, sightings: [] },
        ],
        issues: [],
      },
    );

    expect(model.extensions.map((entry) => entry.key)).toEqual(["skills", "mcp"]);
    expect(model.marketplaceEntries.map((entry) => entry.key)).toEqual(["skills", "mcp", "clis"]);
    expect(model.marketplaceEntries.find((entry) => entry.key === "clis")).toMatchObject({
      badge: "Preview only",
      action: { to: "/marketplace/clis" },
    });
    expect(model.stats.inUse.value).toBe(3);
    expect(model.stats.needsReview.value).toBe(2);
  });
});
