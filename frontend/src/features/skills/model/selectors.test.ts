import { describe, expect, it } from "vitest";

import type { SkillsWorkspaceData } from "./types";
import {
  countManageableUnmanagedRows,
  countUnmanagedRows,
  filterBuiltInRows,
  filterManagedRows,
  filterUnmanagedRows,
  resetManagedSkillsFilters,
  resetUnmanagedSkillsFilters,
} from "./selectors";

const data: SkillsWorkspaceData = {
  summary: { managed: 1, unmanaged: 1, custom: 1, builtIn: 1 },
  harnessColumns: [{ harness: "codex", label: "Codex" }],
  rows: [
    {
      skillRef: "shared:shared-audit",
      name: "Shared Audit",
      description: "Shared audit workflow",
      displayStatus: "Managed",
      attentionMessage: null,
      canManage: false,
      cells: [{ harness: "codex", label: "Codex", state: "disabled", interactive: true }],
    },
    {
      skillRef: "shared:audit-skill",
      name: "Audit Skill",
      description: "Custom audit workflow",
      displayStatus: "Custom",
      attentionMessage: "Modified locally; source updates are disabled.",
      canManage: false,
      cells: [{ harness: "codex", label: "Codex", state: "enabled", interactive: true }],
    },
    {
      skillRef: "unmanaged:trace-lens",
      name: "Trace Lens",
      description: "Trace review workflow",
      displayStatus: "Unmanaged",
      attentionMessage: null,
      canManage: true,
      cells: [{ harness: "codex", label: "Codex", state: "found", interactive: false }],
    },
    {
      skillRef: "builtin:review-helper",
      name: "Review Helper",
      description: "Bundled with OpenCode",
      displayStatus: "Built-in",
      attentionMessage: null,
      canManage: false,
      cells: [{ harness: "codex", label: "Codex", state: "builtin", interactive: false }],
    },
  ],
};

describe("skills workspace model", () => {
  it("partitions managed and unmanaged rows correctly", () => {
    const managedRows = filterManagedRows(data, resetManagedSkillsFilters());
    const builtInRows = filterBuiltInRows(data);
    const unmanagedRows = filterUnmanagedRows(data, resetUnmanagedSkillsFilters());

    expect(managedRows.map((row) => row.name)).toEqual(["Shared Audit", "Audit Skill"]);
    expect(builtInRows.map((row) => row.name)).toEqual(["Review Helper"]);
    expect(unmanagedRows.map((row) => row.name)).toEqual(["Trace Lens"]);
  });

  it("filters managed rows by display status only", () => {
    expect(filterManagedRows(data, resetManagedSkillsFilters()).map((row) => row.name)).toEqual([
      "Shared Audit",
      "Audit Skill",
    ]);
  });

  it("counts unmanaged rows and manageable actions without the deleted overview strip", () => {
    expect(countUnmanagedRows(data)).toBe(1);
    expect(countManageableUnmanagedRows(data)).toBe(1);
  });
});
