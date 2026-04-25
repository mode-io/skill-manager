import { describe, expect, it } from "vitest";

import type { SkillsWorkspaceData } from "./types";
import {
  countAdoptableLocalSkillRows,
  countNeedsReviewRows,
  filterNeedsReviewRows,
  filterSkillsInUseRows,
  resetSkillsNeedsReviewFilters,
  resetSkillsInUseFilters,
} from "./selectors";

const data: SkillsWorkspaceData = {
  summary: { managed: 2, unmanaged: 1 },
  harnessColumns: [{ harness: "codex", label: "Codex", installed: true }],
  rows: [
    {
      skillRef: "shared:shared-audit",
      name: "Shared Audit",
      description: "Shared audit workflow",
      displayStatus: "Managed",
      actions: { canManage: false, canStopManaging: true, canDelete: false },
      cells: [{ harness: "codex", label: "Codex", state: "disabled", interactive: true }],
    },
    {
      skillRef: "shared:audit-skill",
      name: "Audit Skill",
      description: "Locally modified audit workflow",
      displayStatus: "Managed",
      actions: { canManage: false, canStopManaging: true, canDelete: true },
      cells: [{ harness: "codex", label: "Codex", state: "enabled", interactive: true }],
    },
    {
      skillRef: "unmanaged:trace-lens",
      name: "Trace Lens",
      description: "Trace review workflow",
      displayStatus: "Unmanaged",
      actions: { canManage: true, canStopManaging: false, canDelete: false },
      cells: [{ harness: "codex", label: "Codex", state: "found", interactive: false }],
    },
  ],
} as unknown as SkillsWorkspaceData;

describe("skills workspace model", () => {
  it("partitions in-use and needs-review rows correctly", () => {
    const inUseRows = filterSkillsInUseRows(data, resetSkillsInUseFilters());
    const needsReviewRows = filterNeedsReviewRows(data, resetSkillsNeedsReviewFilters());

    expect(inUseRows.map((row) => row.name)).toEqual(["Shared Audit", "Audit Skill"]);
    expect(needsReviewRows.map((row) => row.name)).toEqual(["Trace Lens"]);
  });

  it("treats locally modified shared-store entries as in-use rows", () => {
    expect(filterSkillsInUseRows(data, resetSkillsInUseFilters()).map((row) => row.name)).toEqual([
      "Shared Audit",
      "Audit Skill",
    ]);
  });

  it("searches only user-visible row content and harness labels", () => {
    expect(filterSkillsInUseRows(data, { search: "codex" }).map((row) => row.name)).toEqual([
      "Shared Audit",
      "Audit Skill",
    ]);
    expect(filterSkillsInUseRows(data, { search: "managed" })).toEqual([]);
    expect(filterSkillsInUseRows(data, { search: "local changes" })).toEqual([]);
  });

  it("counts needs-review rows and adoptable actions", () => {
    expect(countNeedsReviewRows(data)).toBe(1);
    expect(countAdoptableLocalSkillRows(data)).toBe(1);
  });
});
