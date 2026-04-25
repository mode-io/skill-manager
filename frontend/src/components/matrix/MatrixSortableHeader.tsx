import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { UiTooltip } from "../ui/UiTooltip";

export type MatrixSortDirection = "asc" | "desc";

interface MatrixSortableHeaderProps {
  label: string;
  leading?: ReactNode;
  active: boolean;
  direction: MatrixSortDirection;
  align?: "start" | "identity" | "harness" | "end";
  logoOnly?: boolean;
  srLabel?: string;
  onClick: () => void;
}

export function MatrixSortableHeader({
  label,
  leading,
  active,
  direction,
  align = "start",
  logoOnly = false,
  srLabel,
  onClick,
}: MatrixSortableHeaderProps) {
  const buttonClassName = logoOnly
    ? "matrix-table__sort-btn matrix-table__sort-btn--harness"
    : "matrix-table__sort-btn";

  const button = (
    <button
      type="button"
      className={buttonClassName}
      data-active={active ? "true" : undefined}
      onClick={onClick}
      aria-label={srLabel ?? `Sort by ${label}`}
    >
      {leading}
      {!logoOnly ? <span className="matrix-table__sort-label">{label}</span> : null}
      {active ? (
        direction === "asc" ? (
          <ChevronUp size={12} aria-hidden="true" />
        ) : (
          <ChevronDown size={12} aria-hidden="true" />
        )
      ) : null}
    </button>
  );

  return (
    <th
      className={`matrix-table__th matrix-table__th--${align}`}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      {logoOnly ? <UiTooltip content={label}>{button}</UiTooltip> : button}
    </th>
  );
}
