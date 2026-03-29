import type { HarnessColumn, SkillTableRow, SkillsPageData } from "../../api/types";

export interface ManagedSkillsFilterState {
  search: string;
}

export interface UnmanagedSkillsFilterState {
  search: string;
}

export interface AlignedHarnessCell {
  column: HarnessColumn;
  cell: SkillTableRow["cells"][number] | null;
}

export function hasActiveManagedSkillsFilters(filters: ManagedSkillsFilterState): boolean {
  return filters.search.trim() !== "";
}

export function hasActiveUnmanagedFilters(filters: UnmanagedSkillsFilterState): boolean {
  return filters.search.trim() !== "";
}

export function resetManagedSkillsFilters(): ManagedSkillsFilterState {
  return {
    search: "",
  };
}

export function resetUnmanagedSkillsFilters(): UnmanagedSkillsFilterState {
  return {
    search: "",
  };
}

export function filterManagedRows(data: SkillsPageData | null, filters: ManagedSkillsFilterState): SkillTableRow[] {
  return selectManagedRows(data).filter((row) => matchesSearch(row, filters.search, ["enabled", "disabled"]));
}

export function filterBuiltInRows(data: SkillsPageData | null): SkillTableRow[] {
  return selectBuiltInRows(data);
}

export function filterUnmanagedRows(data: SkillsPageData | null, filters: UnmanagedSkillsFilterState): SkillTableRow[] {
  return selectUnmanagedRows(data).filter((row) => matchesSearch(row, filters.search, ["found"]));
}

export function countUnmanagedRows(data: SkillsPageData | null): number {
  return selectUnmanagedRows(data).length;
}

export function countManageableUnmanagedRows(data: SkillsPageData | null): number {
  return selectUnmanagedRows(data).filter((row) => row.primaryAction.kind === "manage").length;
}

export function alignHarnessCells(row: SkillTableRow, columns: HarnessColumn[]): AlignedHarnessCell[] {
  return columns.map((column) => ({
    column,
    cell: row.cells.find((item) => item.harness === column.harness) ?? null,
  }));
}

function selectManagedRows(data: SkillsPageData | null): SkillTableRow[] {
  if (!data) {
    return [];
  }
  return data.rows.filter((row) => row.displayStatus === "Managed" || row.displayStatus === "Custom");
}

function selectBuiltInRows(data: SkillsPageData | null): SkillTableRow[] {
  if (!data) {
    return [];
  }
  return data.rows.filter((row) => row.displayStatus === "Built-in");
}

function selectUnmanagedRows(data: SkillsPageData | null): SkillTableRow[] {
  if (!data) {
    return [];
  }
  return data.rows.filter((row) => row.displayStatus === "Unmanaged");
}

function matchesSearch(row: SkillTableRow, search: string, searchableCellStates: string[]): boolean {
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
    row.displayStatus,
    row.attentionMessage ?? "",
    ...harnessLabels,
  ].join(" ").toLowerCase();

  return searchHaystack.includes(normalizedSearch);
}
