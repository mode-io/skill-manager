import type { HarnessCell, HarnessColumn, SkillTableRow } from "../../api/types";
import { ManagedSkillCard } from "./ManagedSkillCard";

interface ManagedSkillsListProps {
  ariaLabel?: string;
  columns: HarnessColumn[];
  rows: SkillTableRow[];
  busyId: string | null;
  selectedSkillRef: string | null;
  onOpenSkill: (skillRef: string) => void;
  onManageSkill: (skillRef: string) => Promise<void>;
  onToggleCell: (row: SkillTableRow, cell: HarnessCell) => void;
}

export function ManagedSkillsList({
  ariaLabel = "Managed skills list",
  columns,
  rows,
  busyId,
  selectedSkillRef,
  onOpenSkill,
  onManageSkill,
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
          onManageSkill={onManageSkill}
          onToggleCell={onToggleCell}
        />
      ))}
    </section>
  );
}
