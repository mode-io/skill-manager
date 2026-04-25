import type { CellActionKey, StructuralSkillAction } from "../../model/pending";
import type { SkillListRow } from "../../model/types";
import { SkillInUseCard } from "./SkillInUseCard";

interface SkillsInUseListProps {
  ariaLabel?: string;
  rows: SkillListRow[];
  pendingToggleKeys: ReadonlySet<CellActionKey>;
  pendingStructuralActions: ReadonlyMap<string, StructuralSkillAction>;
  selectedSkillRef: string | null;
  checkedRefs: ReadonlySet<string>;
  onOpenSkill: (skillRef: string) => void;
  onToggleChecked: (skillRef: string) => void;
  onSetAllHarnesses: (
    skillRef: string,
    target: "enabled" | "disabled",
  ) => Promise<unknown> | void;
  onRequestRemove: (row: SkillListRow) => void;
  onRequestDelete: (row: SkillListRow) => void;
}

export function SkillsInUseList({
  ariaLabel = "Skills in use list",
  rows,
  pendingToggleKeys,
  pendingStructuralActions,
  selectedSkillRef,
  checkedRefs,
  onOpenSkill,
  onToggleChecked,
  onSetAllHarnesses,
  onRequestRemove,
  onRequestDelete,
}: SkillsInUseListProps) {
  return (
    <section className="skill-grid" aria-label={ariaLabel}>
      {rows.map((row) => (
        <SkillInUseCard
          key={row.skillRef}
          row={row}
          pendingToggleKeys={pendingToggleKeys}
          pendingStructuralAction={pendingStructuralActions.get(row.skillRef) ?? null}
          selected={selectedSkillRef === row.skillRef}
          checked={checkedRefs.has(row.skillRef)}
          onOpenSkill={onOpenSkill}
          onToggleChecked={onToggleChecked}
          onSetAllHarnesses={onSetAllHarnesses}
          onRequestRemove={onRequestRemove}
          onRequestDelete={onRequestDelete}
        />
      ))}
    </section>
  );
}
