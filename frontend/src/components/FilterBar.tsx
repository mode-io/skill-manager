import { Search } from "lucide-react";
import type { ReactNode } from "react";

export interface PillOption {
  value: string;
  label: string;
  count?: number | null;
}

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  pills?: PillOption[];
  activePill?: string;
  onPillChange?: (value: string) => void;
  trailing?: ReactNode;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  searchLabel = "Filter search",
  pills,
  activePill,
  onPillChange,
  trailing,
}: FilterBarProps) {
  return (
    <div className="filter-bar">
      <div className="filter-bar__search">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          aria-label={searchLabel}
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      {pills && pills.length > 0 ? (
        <div className="pill-group" role="group" aria-label="Filter options">
          {pills.map((pill) => (
            <button
              key={pill.value}
              type="button"
              className="pill-group__pill"
              data-active={activePill === pill.value}
              onClick={() => onPillChange?.(pill.value)}
            >
              <span>{pill.label}</span>
              {pill.count != null ? <span className="pill-group__count">{pill.count}</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      {trailing}
    </div>
  );
}
