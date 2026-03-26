import type { HarnessCell, HarnessColumn, SkillTableRow } from "../../api/types";
import { ManagedSkillCard } from "./ManagedSkillCard";

interface ManagedSkillsListProps {
  columns: HarnessColumn[];
  rows: SkillTableRow[];
  busyId: string | null;
  onOpenSkill: (skillRef: string) => void;
  onToggleCell: (row: SkillTableRow, cell: HarnessCell) => void;
  onRunPrimaryAction: (row: SkillTableRow) => void;
}

export function ManagedSkillsList({
  columns,
  rows,
  busyId,
  onOpenSkill,
  onToggleCell,
  onRunPrimaryAction,
}: ManagedSkillsListProps): JSX.Element {
  return (
    <section className="skills-list" aria-label="Managed skills list">
      {rows.map((row) => (
        <ManagedSkillCard
          key={row.skillRef}
          row={row}
          columns={columns}
          busyId={busyId}
          onOpenSkill={onOpenSkill}
          onToggleCell={onToggleCell}
          onRunPrimaryAction={onRunPrimaryAction}
        />
      ))}
    </section>
  );
}
