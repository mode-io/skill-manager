import type { HarnessCell, HarnessColumn, SkillTableRow } from "../../api/types";
import { SkillsRow } from "./SkillsRow";

interface SkillsTableProps {
  columns: HarnessColumn[];
  rows: SkillTableRow[];
  busyId: string | null;
  onOpenSkill: (skillRef: string) => void;
  onToggleCell: (row: SkillTableRow, cell: HarnessCell) => void;
  onRunPrimaryAction: (row: SkillTableRow) => void;
}

export function SkillsTable({
  columns,
  rows,
  busyId,
  onOpenSkill,
  onToggleCell,
  onRunPrimaryAction,
}: SkillsTableProps): JSX.Element {
  return (
    <div className="skills-table-wrap">
      <table className="skills-table">
        <thead>
          <tr>
            <th>Skill</th>
            <th>Status</th>
            {columns.map((column) => (
              <th key={column.harness}>{column.label}</th>
            ))}
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <SkillsRow
              key={row.skillRef}
              row={row}
              columns={columns}
              busyId={busyId}
              onOpenSkill={onOpenSkill}
              onToggleCell={onToggleCell}
              onRunPrimaryAction={onRunPrimaryAction}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
