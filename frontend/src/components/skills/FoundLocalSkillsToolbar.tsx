import { ArrowUpDown, ChevronDown, RotateCcw, Search, Wrench } from "lucide-react";

import type { HarnessColumn } from "../../api/types";
import { harnessFilterOptions, type FoundLocalSkillsFilterState, type SkillsSortOption } from "./model";

interface FoundLocalSkillsToolbarProps {
  columns: HarnessColumn[];
  filters: FoundLocalSkillsFilterState;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onHarnessFilterChange: (value: string) => void;
  onSortByChange: (value: SkillsSortOption) => void;
  onResetFilters: () => void;
}

export function FoundLocalSkillsToolbar({
  columns,
  filters,
  hasActiveFilters,
  onSearchChange,
  onHarnessFilterChange,
  onSortByChange,
  onResetFilters,
}: FoundLocalSkillsToolbarProps): JSX.Element {
  return (
    <div className="skills-toolbar" aria-label="Found local skills filters">
      <div className="skills-toolbar__search">
        <Search size={16} className="skills-toolbar__search-icon" />
        <input
          type="text"
          value={filters.search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search found skills by name, description, or tool"
          aria-label="Search found local skills"
        />
      </div>

      <div className="skills-toolbar__controls">
        <label className="skills-toolbar__select">
          <Wrench size={14} />
          <select value={filters.harnessFilter} onChange={(event) => onHarnessFilterChange(event.target.value)} aria-label="Found local tool filter">
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
          <select value={filters.sortBy} onChange={(event) => onSortByChange(event.target.value as SkillsSortOption)} aria-label="Found local sort order">
            <option value="default">Recommended</option>
            <option value="name">Name</option>
          </select>
          <ChevronDown size={14} className="skills-toolbar__chevron" />
        </label>

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
