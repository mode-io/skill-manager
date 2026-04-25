import type { HarnessCell, HarnessCellState, SkillListRow } from "./types";

export type SortDirection = "asc" | "desc";

export type SortKey = "name" | "coverage" | { harness: string };

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

const HARNESS_STATE_PRIORITY: Record<HarnessCellState, number> = {
  enabled: 0,
  disabled: 1,
  found: 2,
  empty: 3,
};

function countEnabled(row: SkillListRow): number {
  let count = 0;
  for (const cell of row.cells) {
    if (cell.state === "enabled") count += 1;
  }
  return count;
}

function findCell(row: SkillListRow, harness: string): HarnessCell | undefined {
  return row.cells.find((cell) => cell.harness === harness);
}

function compareByName(a: SkillListRow, b: SkillListRow): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function sortRows(rows: SkillListRow[], sort: SortState): SkillListRow[] {
  const directionMultiplier = sort.direction === "asc" ? 1 : -1;
  const next = rows.slice();

  if (sort.key === "name") {
    next.sort((a, b) => compareByName(a, b) * directionMultiplier);
    return next;
  }

  if (sort.key === "coverage") {
    next.sort((a, b) => {
      const diff = countEnabled(a) - countEnabled(b);
      if (diff !== 0) return diff * directionMultiplier;
      return compareByName(a, b);
    });
    return next;
  }

  const harness = sort.key.harness;
  next.sort((a, b) => {
    const aCell = findCell(a, harness);
    const bCell = findCell(b, harness);
    const aPriority = aCell ? HARNESS_STATE_PRIORITY[aCell.state] : HARNESS_STATE_PRIORITY.empty;
    const bPriority = bCell ? HARNESS_STATE_PRIORITY[bCell.state] : HARNESS_STATE_PRIORITY.empty;
    const diff = aPriority - bPriority;
    if (diff !== 0) return diff * directionMultiplier;
    return compareByName(a, b);
  });
  return next;
}

export function isHarnessSortKey(key: SortKey): key is { harness: string } {
  return typeof key === "object" && key !== null && "harness" in key;
}

export function sortKeysEqual(a: SortKey, b: SortKey): boolean {
  if (typeof a === "string" && typeof b === "string") return a === b;
  if (isHarnessSortKey(a) && isHarnessSortKey(b)) return a.harness === b.harness;
  return false;
}
