import type { HarnessColumn, SkillStatus, SkillTableRow, SkillsPageData } from "../../api/types";

export type SkillsSortOption = "default" | "name";
export type SkillsStatusFilter = "all" | "needsAttention" | SkillStatus;
export type SkillsOverviewMetric = "needsAction" | "managed" | "foundLocally" | "custom" | "builtIn";

export interface SkillsFilterState {
  search: string;
  statusFilter: SkillsStatusFilter;
  harnessFilter: string;
  sortBy: SkillsSortOption;
  showBuiltIns: boolean;
}

export function filterSkillsRows(data: SkillsPageData | null, filters: SkillsFilterState): SkillTableRow[] {
  if (!data) {
    return [];
  }

  const normalizedSearch = filters.search.trim().toLowerCase();
  const rows = data.rows.filter((row) => {
    if (!filters.showBuiltIns && row.displayStatus === "Built-in") {
      return false;
    }
    if (!matchesStatusFilter(row, filters.statusFilter)) {
      return false;
    }
    if (filters.harnessFilter !== "all") {
      const cell = row.cells.find((item) => item.harness === filters.harnessFilter);
      if (!cell || cell.state === "empty") {
        return false;
      }
    }
    if (!normalizedSearch) {
      return true;
    }
    const searchHaystack = [row.name, row.description, row.displayStatus, row.attentionMessage ?? ""].join(" ").toLowerCase();
    return searchHaystack.includes(normalizedSearch);
  });

  rows.sort((left, right) => {
    if (filters.sortBy === "name") {
      return left.name.localeCompare(right.name);
    }
    return left.defaultSortRank - right.defaultSortRank || left.name.localeCompare(right.name);
  });

  return rows;
}

export function hasActiveSkillsFilters(filters: SkillsFilterState): boolean {
  return (
    filters.search.trim() !== ""
    || filters.statusFilter !== "all"
    || filters.harnessFilter !== "all"
    || filters.sortBy !== "default"
    || filters.showBuiltIns
  );
}

export function resetSkillsFilters(): SkillsFilterState {
  return {
    search: "",
    statusFilter: "all",
    harnessFilter: "all",
    sortBy: "default",
    showBuiltIns: false,
  };
}

export function overviewMetricActive(metric: SkillsOverviewMetric, filters: SkillsFilterState): boolean {
  switch (metric) {
    case "needsAction":
      return filters.statusFilter === "needsAttention";
    case "managed":
      return filters.statusFilter === "Managed";
    case "foundLocally":
      return filters.statusFilter === "Found locally";
    case "custom":
      return filters.statusFilter === "Custom";
    case "builtIn":
      return filters.showBuiltIns;
    default:
      return false;
  }
}

export function nextStatusFilterForMetric(metric: SkillsOverviewMetric, current: SkillsStatusFilter): SkillsStatusFilter {
  if (metric === "builtIn") {
    return current;
  }

  const target: SkillsStatusFilter = {
    needsAction: "needsAttention",
    managed: "Managed",
    foundLocally: "Found locally",
    custom: "Custom",
    builtIn: current,
  }[metric];
  return current === target ? "all" : target;
}

export function harnessFilterOptions(columns: HarnessColumn[]): Array<{ value: string; label: string }> {
  return [
    { value: "all", label: "All tools" },
    ...columns.map((column) => ({ value: column.harness, label: column.label })),
  ];
}

function matchesStatusFilter(row: SkillTableRow, statusFilter: SkillsStatusFilter): boolean {
  if (statusFilter === "all") {
    return true;
  }
  if (statusFilter === "needsAttention") {
    return row.needsAttention;
  }
  return row.displayStatus === statusFilter;
}
