import { skillStatusConcept } from "../../../lib/product-language";
import type { HarnessCellState, HarnessColumn, SkillListRow, SkillsWorkspaceData } from "./types";

export interface SkillsInUseFilterState {
  search: string;
}

export interface SkillsNeedsReviewFilterState {
  search: string;
}

export interface AlignedHarnessCell {
  column: HarnessColumn;
  cell: SkillListRow["cells"][number] | null;
}

export function hasActiveSkillsInUseFilters(filters: SkillsInUseFilterState): boolean {
  return filters.search.trim() !== "";
}

export function hasActiveNeedsReviewFilters(filters: SkillsNeedsReviewFilterState): boolean {
  return filters.search.trim() !== "";
}

export function resetSkillsInUseFilters(): SkillsInUseFilterState {
  return {
    search: "",
  };
}

export function resetSkillsNeedsReviewFilters(): SkillsNeedsReviewFilterState {
  return {
    search: "",
  };
}

export function filterSkillsInUseRows(data: SkillsWorkspaceData | null, filters: SkillsInUseFilterState): SkillListRow[] {
  return selectSkillsInUseRows(data).filter((row) => matchesSearch(row, filters.search, ["enabled", "disabled"]));
}

export function filterNeedsReviewRows(data: SkillsWorkspaceData | null, filters: SkillsNeedsReviewFilterState): SkillListRow[] {
  return selectNeedsReviewRows(data).filter((row) => matchesSearch(row, filters.search, ["found"]));
}

export function countNeedsReviewRows(data: SkillsWorkspaceData | null): number {
  return selectNeedsReviewRows(data).length;
}

export function countAdoptableLocalSkillRows(data: SkillsWorkspaceData | null): number {
  return selectNeedsReviewRows(data).filter((row) => row.actions.canManage).length;
}

export function alignHarnessCells(row: SkillListRow, columns: HarnessColumn[]): AlignedHarnessCell[] {
  return columns.map((column) => ({
    column,
    cell: row.cells.find((item) => item.harness === column.harness) ?? null,
  }));
}

function selectSkillsInUseRows(data: SkillsWorkspaceData | null): SkillListRow[] {
  if (!data) {
    return [];
  }
  return data.rows.filter((row) => skillStatusConcept(row.displayStatus) === "inUse");
}

function selectNeedsReviewRows(data: SkillsWorkspaceData | null): SkillListRow[] {
  if (!data) {
    return [];
  }
  return data.rows.filter((row) => skillStatusConcept(row.displayStatus) === "needsReview");
}

function matchesSearch(
  row: SkillListRow,
  search: string,
  searchableCellStates: readonly HarnessCellState[],
): boolean {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) {
    return true;
  }

  const harnessLabels = row.cells
    .filter((cell) => searchableCellStates.includes(cell.state))
    .map((cell) => cell.label);

  const searchHaystack = [
    row.name,
    row.description,
    ...harnessLabels,
  ].join(" ").toLowerCase();

  return searchHaystack.includes(normalizedSearch);
}
