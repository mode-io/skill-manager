import { describe, expect, it } from "vitest";

import type { SkillsPageData } from "../api/types";
import {
  buildFoundLocalOverview,
  buildManagedOverview,
  filterFoundLocalRows,
  filterManagedRows,
  resetFoundLocalSkillsFilters,
  resetManagedSkillsFilters,
} from "../components/skills/model";

const data: SkillsPageData = {
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
};

describe("skills workspace model", () => {
  it("partitions managed and found-local rows correctly", () => {
    const managedRows = filterManagedRows(data, resetManagedSkillsFilters());
    const foundLocalRows = filterFoundLocalRows(data, resetFoundLocalSkillsFilters());

    expect(managedRows.map((row) => row.name)).toEqual(["Audit Skill", "Shared Audit"]);
    expect(foundLocalRows.map((row) => row.name)).toEqual(["Trace Lens"]);
  });

  it("builds page-specific overview counts", () => {
    expect(buildManagedOverview(data)).toEqual({
      managed: 1,
      custom: 1,
      builtIn: 1,
    });
    expect(buildFoundLocalOverview(data)).toEqual({
      foundLocally: 1,
      eligibleNow: 1,
    });
  });
});
