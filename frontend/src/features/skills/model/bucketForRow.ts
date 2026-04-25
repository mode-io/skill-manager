import type { SkillListRow } from "./types";

export type SkillBucket = "disabled" | "selective" | "enabled";

export function bucketForRow(row: SkillListRow): SkillBucket {
  const interactive = row.cells.filter((cell) => cell.interactive);
  if (interactive.length === 0) {
    return "enabled";
  }
  const allEnabled = interactive.every((cell) => cell.state === "enabled");
  if (allEnabled) return "enabled";
  const allDisabled = interactive.every((cell) => cell.state === "disabled");
  if (allDisabled) return "disabled";
  return "selective";
}

export interface BucketedRows {
  disabled: SkillListRow[];
  selective: SkillListRow[];
  enabled: SkillListRow[];
}

export function bucketRows(rows: SkillListRow[]): BucketedRows {
  const result: BucketedRows = { disabled: [], selective: [], enabled: [] };
  for (const row of rows) {
    result[bucketForRow(row)].push(row);
  }
  return result;
}
