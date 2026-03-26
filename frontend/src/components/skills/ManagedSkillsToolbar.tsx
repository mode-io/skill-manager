import { ArrowUpDown, ChevronDown, RotateCcw, Search, Wrench } from "lucide-react";

import type { HarnessColumn } from "../../api/types";
import {
  harnessFilterOptions,
  type ManagedSkillsFilterState,
  type ManagedSkillsStatusFilter,
  type SkillsSortOption,
} from "./model";

interface ManagedSkillsToolbarProps {
  columns: HarnessColumn[];
  filters: ManagedSkillsFilterState;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: ManagedSkillsStatusFilter) => void;
  onHarnessFilterChange: (value: string) => void;
  onSortByChange: (value: SkillsSortOption) => void;
  onShowBuiltInsChange: (value: boolean) => void;
  onResetFilters: () => void;
}

const STATUS_OPTIONS: Array<{ value: ManagedSkillsStatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "needsAttention", label: "Needs action" },
  { value: "Managed", label: "Managed" },
  { value: "Custom", label: "Custom" },
];

export function ManagedSkillsToolbar({
  columns,
  filters,
  hasActiveFilters,
  onSearchChange,
  onStatusFilterChange,
  onHarnessFilterChange,
  onSortByChange,
  onShowBuiltInsChange,
  onResetFilters,
}: ManagedSkillsToolbarProps): JSX.Element {
  return (
    <div className="skills-toolbar" aria-label="Managed skills filters">
      <div className="skills-toolbar__search">
        <Search size={16} className="skills-toolbar__search-icon" />
        <input
          type="text"
          value={filters.search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search managed skills by name, description, or state"
          aria-label="Search managed skills"
        />
      </div>

      <div className="skills-toolbar__controls">
        <div className="skills-toolbar__segments" aria-label="Managed status filter">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`skills-toolbar__segment${filters.statusFilter === option.value ? " is-active" : ""}`}
              onClick={() => onStatusFilterChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="skills-toolbar__select">
          <Wrench size={14} />
          <select value={filters.harnessFilter} onChange={(event) => onHarnessFilterChange(event.target.value)} aria-label="Managed tool filter">
            {harnessFilterOptions(columns).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="skills-toolbar__chevron" />
        </label>

        <label className="skills-toolbar__select">
          <ArrowUpDown size={14} />
          <select value={filters.sortBy} onChange={(event) => onSortByChange(event.target.value as SkillsSortOption)} aria-label="Managed sort order">
            <option value="default">Recommended</option>
            <option value="name">Name</option>
          </select>
          <ChevronDown size={14} className="skills-toolbar__chevron" />
        </label>

        <button
          type="button"
          className={`skills-toolbar__toggle${filters.showBuiltIns ? " is-active" : ""}`}
          onClick={() => onShowBuiltInsChange(!filters.showBuiltIns)}
        >
          {filters.showBuiltIns ? "Built-ins visible" : "Show built-ins"}
        </button>

        {hasActiveFilters ? (
          <button type="button" className="skills-toolbar__reset" onClick={onResetFilters}>
            <RotateCcw size={14} />
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}
