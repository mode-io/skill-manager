import type { HarnessCell, HarnessColumn, SkillListRow } from "../../model/types";
import { ManagedSkillCard } from "./ManagedSkillCard";

interface ManagedSkillsListProps {
  ariaLabel?: string;
  columns: HarnessColumn[];
  rows: SkillListRow[];
  busyId: string | null;
  selectedSkillRef: string | null;
  onOpenSkill: (skillRef: string) => void;
  onToggleCell: (row: SkillListRow, cell: HarnessCell) => void;
}

export function ManagedSkillsList({
  ariaLabel = "Managed skills list",
  columns,
  rows,
  busyId,
  selectedSkillRef,
  onOpenSkill,
  onToggleCell,
}: ManagedSkillsListProps) {
  return (
    <section className="skills-list" aria-label={ariaLabel}>
      {rows.map((row) => (
        <ManagedSkillCard
          key={row.skillRef}
          row={row}
          columns={columns}
          busyId={busyId}
          selected={selectedSkillRef === row.skillRef}
          onOpenSkill={onOpenSkill}
          onToggleCell={onToggleCell}
        />
      ))}
    </section>
  );
}
