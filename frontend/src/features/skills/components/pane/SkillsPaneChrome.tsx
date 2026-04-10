import type { ReactNode } from "react";

import { RotateCcw, Search } from "lucide-react";

interface SkillsPaneChromeProps {
  title: string;
  actions?: ReactNode;
  searchValue: string;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onReset: () => void;
  searchLabel: string;
  searchInputLabel: string;
  searchPlaceholder: string;
}

export function SkillsPaneChrome({
  title,
  actions,
  searchValue,
  hasActiveFilters,
  onSearchChange,
  onReset,
  searchLabel,
  searchInputLabel,
  searchPlaceholder,
}: SkillsPaneChromeProps) {
  return (
    <div className="skills-pane__chrome">
      <div className="skills-pane__header">
        <div className="skills-pane__header-copy">
          <h3>{title}</h3>
        </div>
        {actions ? <div className="skills-pane__header-actions">{actions}</div> : null}
      </div>

      <div className="skills-pane__search" role="search" aria-label={searchLabel}>
        <div className={`skills-pane__search-field${hasActiveFilters ? " is-reset-visible" : ""}`}>
          <Search size={16} className="skills-pane__search-icon" />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchInputLabel}
          />
          {hasActiveFilters ? (
            <button type="button" className="skills-pane__search-reset" onClick={onReset}>
              <RotateCcw size={14} />
              Reset
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
