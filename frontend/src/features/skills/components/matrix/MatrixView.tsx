import { useMemo, useState } from "react";

import {
  MatrixHarnessIcon,
  MatrixSortableHeader,
  MatrixTable,
} from "../../../../components/matrix";
import { MatrixRow } from "./MatrixRow";
import { sortRows, sortKeysEqual, type SortKey, type SortState } from "../../model/sortRows";
import type { CellActionKey } from "../../model/pending";
import type { HarnessCell, HarnessColumn, SkillListRow } from "../../model/types";

interface MatrixViewProps {
  rows: SkillListRow[];
  harnessColumns: HarnessColumn[];
  checkedRefs: ReadonlySet<string>;
  selectedSkillRef: string | null;
  pendingToggleKeys: ReadonlySet<CellActionKey>;
  onOpenSkill: (skillRef: string) => void;
  onToggleChecked: (skillRef: string) => void;
  onToggleCell: (row: SkillListRow, cell: HarnessCell) => void;
}

const INITIAL_SORT: SortState = { key: "name", direction: "asc" };

export function MatrixView({
  rows,
  harnessColumns,
  checkedRefs,
  selectedSkillRef,
  pendingToggleKeys,
  onOpenSkill,
  onToggleChecked,
  onToggleCell,
}: MatrixViewProps) {
  const [sort, setSort] = useState<SortState>(INITIAL_SORT);

  const sortedRows = useMemo(() => sortRows(rows, sort), [rows, sort]);

  const requestSort = (key: SortKey) => {
    setSort((current) => {
      if (sortKeysEqual(current.key, key)) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  return (
    <MatrixTable
      ariaLabel="Skills harness matrix"
      harnessColumnCount={harnessColumns.length}
      harnessColumnWidth="52px"
      compactColumnWidth="140px"
      coverageColumnWidth="72px"
    >
      <thead className="matrix-table__head">
        <tr>
          <th className="matrix-table__th matrix-table__th--checkbox" aria-label="Select" />
          <MatrixSortableHeader
            label="Name"
            align="identity"
            active={sortKeysEqual(sort.key, "name")}
            direction={sort.direction}
            onClick={() => requestSort("name")}
          />
          {harnessColumns.map((column) => {
            const key: SortKey = { harness: column.harness };
            return (
              <MatrixSortableHeader
                key={column.harness}
                label={column.label}
                align="harness"
                active={sortKeysEqual(sort.key, key)}
                direction={sort.direction}
                logoOnly
                leading={
                  <MatrixHarnessIcon
                    label={column.label}
                    logoKey={column.logoKey}
                    harness={column.harness}
                  />
                }
                srLabel={`Sort by ${column.label}`}
                onClick={() => requestSort(key)}
              />
            );
          })}
          <th className="matrix-table__th matrix-table__th--compact" aria-label="Harnesses">
            Harnesses
          </th>
          <MatrixSortableHeader
            label="Active"
            align="end"
            active={sortKeysEqual(sort.key, "coverage")}
            direction={sort.direction}
            onClick={() => requestSort("coverage")}
          />
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row) => (
          <MatrixRow
            key={row.skillRef}
            row={row}
            harnessColumns={harnessColumns}
            checked={checkedRefs.has(row.skillRef)}
            selected={row.skillRef === selectedSkillRef}
            pendingToggleKeys={pendingToggleKeys}
            onOpenSkill={onOpenSkill}
            onToggleChecked={onToggleChecked}
            onToggleCell={onToggleCell}
          />
        ))}
      </tbody>
    </MatrixTable>
  );
}
