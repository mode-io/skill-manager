import type { HarnessCell, HarnessColumn, SkillTableRow } from "../../api/types";
import { ManagedSkillCardBody } from "./ManagedSkillCardBody";
import { ManagedSkillCardHeader } from "./ManagedSkillCardHeader";

interface ManagedSkillCardProps {
  row: SkillTableRow;
  columns: HarnessColumn[];
  busyId: string | null;
  onOpenSkill: (skillRef: string) => void;
  onToggleCell: (row: SkillTableRow, cell: HarnessCell) => void;
  onRunPrimaryAction: (row: SkillTableRow) => void;
}

export function ManagedSkillCard({
  row,
  columns,
  busyId,
  onOpenSkill,
  onToggleCell,
  onRunPrimaryAction,
}: ManagedSkillCardProps): JSX.Element {
  return (
    <article className={`skill-card${row.needsAttention ? " is-attention" : ""}`}>
      <ManagedSkillCardHeader
        row={row}
        columns={columns}
        busyId={busyId}
        onOpenSkill={onOpenSkill}
        onToggleCell={onToggleCell}
        onRunPrimaryAction={onRunPrimaryAction}
      />
      <ManagedSkillCardBody row={row} />
    </article>
  );
}
