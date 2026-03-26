import type { HarnessColumn, SkillStatus, SkillTableRow, SkillsPageData } from "../../api/types";

export type SkillsSortOption = "default" | "name";
export type ManagedSkillsStatusFilter = "all" | "needsAttention" | Extract<SkillStatus, "Managed" | "Custom">;

export interface ManagedSkillsFilterState {
  search: string;
  statusFilter: ManagedSkillsStatusFilter;
  harnessFilter: string;
  sortBy: SkillsSortOption;
  showBuiltIns: boolean;
}

export interface FoundLocalSkillsFilterState {
  search: string;
  harnessFilter: string;
  sortBy: SkillsSortOption;
}

export interface ManagedSkillsOverviewModel {
  managed: number;
  custom: number;
  builtIn: number;
}

export interface FoundLocalSkillsOverviewModel {
  foundLocally: number;
  eligibleNow: number;
}

export function hasActiveManagedSkillsFilters(filters: ManagedSkillsFilterState): boolean {
  return (
    filters.search.trim() !== ""
    || filters.statusFilter !== "all"
    || filters.harnessFilter !== "all"
    || filters.sortBy !== "default"
    || filters.showBuiltIns
  );
}

export function hasActiveFoundLocalSkillsFilters(filters: FoundLocalSkillsFilterState): boolean {
  return (
    filters.search.trim() !== ""
    || filters.harnessFilter !== "all"
    || filters.sortBy !== "default"
  );
}

export function resetManagedSkillsFilters(): ManagedSkillsFilterState {
  return {
    search: "",
    statusFilter: "all",
    harnessFilter: "all",
    sortBy: "default",
    showBuiltIns: false,
  };
}

export function resetFoundLocalSkillsFilters(): FoundLocalSkillsFilterState {
  return {
    search: "",
    harnessFilter: "all",
    sortBy: "default",
  };
}

export function filterManagedRows(data: SkillsPageData | null, filters: ManagedSkillsFilterState): SkillTableRow[] {
  const rows = selectManagedRows(data).filter((row) => {
    if (!matchesManagedStatusFilter(row, filters.statusFilter)) {
      return false;
    }
    if (!matchesHarnessFilter(row, filters.harnessFilter, ["enabled", "disabled"])) {
      return false;
    }
    return matchesSearch(row, filters.search, ["enabled", "disabled", "builtin"]);
  });

  return sortRows(rows, filters.sortBy);
}

export function filterBuiltInRows(data: SkillsPageData | null, showBuiltIns: boolean): SkillTableRow[] {
  if (!showBuiltIns) {
    return [];
  }
  return selectBuiltInRows(data);
}

export function filterFoundLocalRows(data: SkillsPageData | null, filters: FoundLocalSkillsFilterState): SkillTableRow[] {
  const rows = selectFoundLocalRows(data).filter((row) => {
    if (!matchesHarnessFilter(row, filters.harnessFilter, ["found"])) {
      return false;
    }
    return matchesSearch(row, filters.search, ["found"]);
  });

  return sortRows(rows, filters.sortBy);
}

export function buildManagedOverview(data: SkillsPageData | null): ManagedSkillsOverviewModel {
  const managedRows = selectManagedRows(data);
  const builtInRows = selectBuiltInRows(data);

  return {
    managed: managedRows.filter((row) => row.displayStatus === "Managed").length,
    custom: managedRows.filter((row) => row.displayStatus === "Custom").length,
    builtIn: builtInRows.length,
  };
}

export function buildFoundLocalOverview(data: SkillsPageData | null): FoundLocalSkillsOverviewModel {
  const rows = selectFoundLocalRows(data);

  return {
    foundLocally: rows.length,
    eligibleNow: rows.filter((row) => row.primaryAction.kind === "manage").length,
  };
}

export function harnessFilterOptions(columns: HarnessColumn[]): Array<{ value: string; label: string }> {
  return [
    { value: "all", label: "All tools" },
    ...columns.map((column) => ({ value: column.harness, label: column.label })),
  ];
}

export interface AlignedHarnessCell {
  column: HarnessColumn;
  cell: SkillTableRow["cells"][number] | null;
}

export interface SkillRowSummary {
  enabledCount: number;
  actionableCount: number;
  foundCount: number;
  builtInCount: number;
  coverageLabel: string;
}

export function alignHarnessCells(row: SkillTableRow, columns: HarnessColumn[]): AlignedHarnessCell[] {
  return columns.map((column) => ({
    column,
    cell: row.cells.find((item) => item.harness === column.harness) ?? null,
  }));
}

export function summarizeManagedSkillRow(row: SkillTableRow): SkillRowSummary {
  const actionableCells = row.cells.filter((cell) => cell.interactive);
  const enabledCount = actionableCells.filter((cell) => cell.state === "enabled").length;
  const foundCount = row.cells.filter((cell) => cell.state === "found").length;
  const builtInCount = row.cells.filter((cell) => cell.state === "builtin").length;

  return {
    enabledCount,
    actionableCount: actionableCells.length,
    foundCount,
    builtInCount,
    coverageLabel: coverageSummary({
      enabledCount,
      actionableCount: actionableCells.length,
      foundCount,
      builtInCount,
    }),
  };
}

export interface FoundLocalSkillSummary {
  foundCount: number;
  coverageLabel: string;
  locationsLabel: string;
}

export function summarizeFoundLocalSkill(row: SkillTableRow): FoundLocalSkillSummary {
  const harnessLabels = row.cells
    .filter((cell) => cell.state === "found")
    .map((cell) => cell.label);
  const foundCount = harnessLabels.length;

  return {
    foundCount,
    coverageLabel: `Found in ${foundCount} ${pluralize("tool", foundCount)}`,
    locationsLabel: harnessLabels.join(", "),
  };
}

function coverageSummary({
  enabledCount,
  actionableCount,
  foundCount,
  builtInCount,
}: Pick<SkillRowSummary, "enabledCount" | "actionableCount" | "foundCount" | "builtInCount">): string {
  if (actionableCount > 0) {
    if (enabledCount > 0) {
      return `Enabled in ${enabledCount}/${actionableCount} ${pluralize("tool", actionableCount)}`;
    }
    return `Ready in ${actionableCount} ${pluralize("tool", actionableCount)}`;
  }

  if (foundCount > 0) {
    return `Found in ${foundCount} ${pluralize("tool", foundCount)}`;
  }

  if (builtInCount > 0) {
    return `Built in for ${builtInCount} ${pluralize("tool", builtInCount)}`;
  }

  return "No tool coverage";
}

function pluralize(noun: string, count: number): string {
  return count === 1 ? noun : `${noun}s`;
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

function selectFoundLocalRows(data: SkillsPageData | null): SkillTableRow[] {
  if (!data) {
    return [];
  }
  return data.rows.filter((row) => row.displayStatus === "Found locally");
}

function matchesManagedStatusFilter(row: SkillTableRow, statusFilter: ManagedSkillsStatusFilter): boolean {
  if (statusFilter === "all") {
    return true;
  }
  if (statusFilter === "needsAttention") {
    return row.needsAttention;
  }
  return row.displayStatus === statusFilter;
}

function matchesHarnessFilter(row: SkillTableRow, harnessFilter: string, allowedStates: string[]): boolean {
  if (harnessFilter === "all") {
    return true;
  }
  const cell = row.cells.find((item) => item.harness === harnessFilter);
  return Boolean(cell && allowedStates.includes(cell.state));
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

function sortRows(rows: SkillTableRow[], sortBy: SkillsSortOption): SkillTableRow[] {
  return [...rows].sort((left, right) => {
    if (sortBy === "name") {
      return left.name.localeCompare(right.name);
    }
    return left.defaultSortRank - right.defaultSortRank || left.name.localeCompare(right.name);
  });
}
