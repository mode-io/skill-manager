import { describe, expect, it } from "vitest";

import { sortRows, type SortState } from "./sortRows";
import type { HarnessCell, SkillListRow } from "./types";

function makeRow(name: string, cells: HarnessCell[]): SkillListRow {
  return {
    skillRef: `shared:${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    description: "",
    displayStatus: "Managed",
    actions: { canManage: false, canStopManaging: true, canDelete: false },
    cells,
  } as unknown as SkillListRow;
}

const enabled = (harness: string): HarnessCell => ({ harness, label: harness, state: "enabled", interactive: true });
const disabled = (harness: string): HarnessCell => ({ harness, label: harness, state: "disabled", interactive: true });
const empty = (harness: string): HarnessCell => ({ harness, label: harness, state: "empty", interactive: false });

describe("sortRows", () => {
  const rows: SkillListRow[] = [
    makeRow("charlie", [enabled("codex"), disabled("cursor"), disabled("claude")]),
    makeRow("alpha", [disabled("codex"), disabled("cursor"), disabled("claude")]),
    makeRow("Bravo", [enabled("codex"), enabled("cursor"), empty("claude")]),
  ];

  it("sorts by name ascending (case-insensitive)", () => {
    const sorted = sortRows(rows, { key: "name", direction: "asc" });
    expect(sorted.map((r) => r.name)).toEqual(["alpha", "Bravo", "charlie"]);
  });

  it("sorts by name descending", () => {
    const sorted = sortRows(rows, { key: "name", direction: "desc" });
    expect(sorted.map((r) => r.name)).toEqual(["charlie", "Bravo", "alpha"]);
  });

  it("sorts by coverage ascending with name as secondary", () => {
    const sorted = sortRows(rows, { key: "coverage", direction: "asc" });
    // alpha=0, charlie=1, Bravo=2
    expect(sorted.map((r) => r.name)).toEqual(["alpha", "charlie", "Bravo"]);
  });

  it("sorts by coverage descending", () => {
    const sorted = sortRows(rows, { key: "coverage", direction: "desc" });
    expect(sorted.map((r) => r.name)).toEqual(["Bravo", "charlie", "alpha"]);
  });

  it("sorts by a harness column: enabled first, then disabled, then empty", () => {
    const sorted = sortRows(rows, { key: { harness: "claude" }, direction: "asc" });
    // alpha + charlie are disabled on claude, while Bravo is not present there.
    // Priority: disabled beats empty, with name as the tie-breaker.
    expect(sorted.map((r) => r.name)).toEqual(["alpha", "charlie", "Bravo"]);
  });

  it("does not mutate the original array", () => {
    const original = rows.slice();
    sortRows(rows, { key: "coverage", direction: "desc" });
    expect(rows).toEqual(original);
  });

  it("returns a new array reference", () => {
    const result = sortRows(rows, { key: "name", direction: "asc" } satisfies SortState);
    expect(result).not.toBe(rows);
  });
});
