import type { CSSProperties, ReactNode } from "react";

interface MatrixTableProps {
  ariaLabel: string;
  children: ReactNode;
  harnessColumnWidth?: string;
  compactColumnWidth?: string;
  coverageColumnWidth?: string;
  minWidth?: string;
}

export function MatrixTable({
  ariaLabel,
  children,
  harnessColumnWidth = "52px",
  compactColumnWidth = "140px",
  coverageColumnWidth = "64px",
  minWidth,
}: MatrixTableProps) {
  const style = {
    "--matrix-harness-column-width": harnessColumnWidth,
    "--matrix-compact-column-width": compactColumnWidth,
    "--matrix-coverage-column-width": coverageColumnWidth,
    ...(minWidth ? { "--matrix-table-min-width": minWidth } : {}),
  } as CSSProperties;

  // No <colgroup>: with `table-layout: fixed` the column widths come from the
  // header cells' own classes (`matrix-table__th--*`). A colgroup would have to
  // mirror exactly which cells each view renders, and it can't — views differ
  // (some render no compact column, some end in Action rather than Active) and
  // the compact/harness cells are toggled with `display: none` per breakpoint,
  // which removes them from the row entirely. Every mismatch shifted the
  // trailing cells one column left, leaving an empty column at the right edge
  // and the last column's content overflowing off-centre.
  return (
    <div className="matrix-table-wrapper" style={style}>
      <table className="matrix-table" aria-label={ariaLabel}>
        {children}
      </table>
    </div>
  );
}
