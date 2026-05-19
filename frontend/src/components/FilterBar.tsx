import { Search } from "lucide-react";
import type { ReactNode } from "react";

import { useCommonCopy } from "../i18n";

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
  searchPlaceholder,
  searchLabel,
  pills,
  activePill,
  onPillChange,
  trailing,
}: FilterBarProps) {
  const common = useCommonCopy();
  const renderedSearchPlaceholder = searchPlaceholder ?? common.search.placeholder;
  const renderedSearchLabel = searchLabel ?? common.search.label;

  return (
    <div className="filter-bar">
      <div className="filter-bar__search">
        <Search size={15} aria-hidden="true" />
        <input
          type="search"
          aria-label={renderedSearchLabel}
          placeholder={renderedSearchPlaceholder}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      {pills && pills.length > 0 ? (
        <div className="pill-group" role="group" aria-label={common.search.filterOptions}>
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
