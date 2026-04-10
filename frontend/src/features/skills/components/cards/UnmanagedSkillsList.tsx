import type { StructuralSkillAction } from "../../model/pending";
import type { SkillListRow } from "../../model/types";
import { UnmanagedSkillCard } from "./UnmanagedSkillCard";

interface UnmanagedSkillsListProps {
  rows: SkillListRow[];
  pendingStructuralActions: ReadonlyMap<string, StructuralSkillAction>;
  bulkActionPending: boolean;
  selectedSkillRef: string | null;
  onOpenSkill: (skillRef: string) => void;
  onManageSkill: (skillRef: string) => Promise<void>;
}

export function UnmanagedSkillsList({
  rows,
  pendingStructuralActions,
  bulkActionPending,
  selectedSkillRef,
  onOpenSkill,
  onManageSkill,
}: UnmanagedSkillsListProps) {
  return (
    <section className="unmanaged-skills-list" aria-label="Unmanaged skills list">
      {rows.map((row) => (
        <UnmanagedSkillCard
          key={row.skillRef}
          row={row}
          pendingStructuralAction={pendingStructuralActions.get(row.skillRef) ?? null}
          bulkActionPending={bulkActionPending}
          selected={selectedSkillRef === row.skillRef}
          onOpenSkill={onOpenSkill}
          onManageSkill={onManageSkill}
        />
      ))}
    </section>
  );
}
