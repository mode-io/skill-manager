import type { CSSProperties, ReactNode } from "react";

interface MatrixTableProps {
  ariaLabel: string;
  harnessColumnCount: number;
  children: ReactNode;
  harnessColumnWidth?: string;
  compactColumnWidth?: string;
  coverageColumnWidth?: string;
  minWidth?: string;
}

export function MatrixTable({
  ariaLabel,
  harnessColumnCount,
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

  return (
    <div className="matrix-table-wrapper" style={style}>
      <table className="matrix-table" aria-label={ariaLabel}>
        <colgroup>
          <col className="matrix-table__col-checkbox" />
          <col className="matrix-table__col-identity" />
          {Array.from({ length: harnessColumnCount }, (_, index) => (
            <col key={index} className="matrix-table__col-harness" />
          ))}
          <col className="matrix-table__col-compact" />
          <col className="matrix-table__col-coverage" />
        </colgroup>
        {children}
      </table>
    </div>
  );
}
