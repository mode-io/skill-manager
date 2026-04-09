import type { HarnessColumn, SkillListRow, SkillsWorkspaceData } from "./types";

export interface ManagedSkillsFilterState {
  search: string;
}

export interface UnmanagedSkillsFilterState {
  search: string;
}

export interface AlignedHarnessCell {
  column: HarnessColumn;
  cell: SkillListRow["cells"][number] | null;
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

export function filterManagedRows(data: SkillsWorkspaceData | null, filters: ManagedSkillsFilterState): SkillListRow[] {
  return selectManagedRows(data).filter((row) => matchesSearch(row, filters.search, ["enabled", "disabled"]));
}

export function filterBuiltInRows(data: SkillsWorkspaceData | null): SkillListRow[] {
  return selectBuiltInRows(data);
}

export function filterUnmanagedRows(data: SkillsWorkspaceData | null, filters: UnmanagedSkillsFilterState): SkillListRow[] {
  return selectUnmanagedRows(data).filter((row) => matchesSearch(row, filters.search, ["found"]));
}

export function countUnmanagedRows(data: SkillsWorkspaceData | null): number {
  return selectUnmanagedRows(data).length;
}

export function countManageableUnmanagedRows(data: SkillsWorkspaceData | null): number {
  return selectUnmanagedRows(data).filter((row) => row.canManage).length;
}

export function alignHarnessCells(row: SkillListRow, columns: HarnessColumn[]): AlignedHarnessCell[] {
  return columns.map((column) => ({
    column,
    cell: row.cells.find((item) => item.harness === column.harness) ?? null,
  }));
}

function selectManagedRows(data: SkillsWorkspaceData | null): SkillListRow[] {
  if (!data) {
    return [];
  }
  return data.rows.filter((row) => row.displayStatus === "Managed" || row.displayStatus === "Custom");
}

function selectBuiltInRows(data: SkillsWorkspaceData | null): SkillListRow[] {
  if (!data) {
    return [];
  }
  return data.rows.filter((row) => row.displayStatus === "Built-in");
}

function selectUnmanagedRows(data: SkillsWorkspaceData | null): SkillListRow[] {
  if (!data) {
    return [];
  }
  return data.rows.filter((row) => row.displayStatus === "Unmanaged");
}

function matchesSearch(row: SkillListRow, search: string, searchableCellStates: string[]): boolean {
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
