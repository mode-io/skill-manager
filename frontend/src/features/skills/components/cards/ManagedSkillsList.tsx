import type { CellActionKey, StructuralSkillAction } from "../../model/pending";
import type { HarnessCell, HarnessColumn, SkillListRow } from "../../model/types";
import { ManagedSkillCard } from "./ManagedSkillCard";

interface ManagedSkillsListProps {
  ariaLabel?: string;
  columns: HarnessColumn[];
  rows: SkillListRow[];
  pendingToggleKeys: ReadonlySet<CellActionKey>;
  pendingStructuralActions: ReadonlyMap<string, StructuralSkillAction>;
  selectedSkillRef: string | null;
  onOpenSkill: (skillRef: string) => void;
  onToggleCell: (row: SkillListRow, cell: HarnessCell) => void;
}

export function ManagedSkillsList({
  ariaLabel = "Managed skills list",
  columns,
  rows,
  pendingToggleKeys,
  pendingStructuralActions,
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
          pendingToggleKeys={pendingToggleKeys}
          pendingStructuralAction={pendingStructuralActions.get(row.skillRef) ?? null}
          selected={selectedSkillRef === row.skillRef}
          onOpenSkill={onOpenSkill}
          onToggleCell={onToggleCell}
        />
      ))}
    </section>
  );
}
