import type { StructuralSkillAction } from "../../model/pending";
import type { SkillListRow } from "../../model/types";
import { SkillNeedsReviewCard } from "./SkillNeedsReviewCard";

interface SkillsNeedsReviewListProps {
  rows: SkillListRow[];
  pendingStructuralActions: ReadonlyMap<string, StructuralSkillAction>;
  bulkActionPending: boolean;
  selectedSkillRef: string | null;
  onOpenSkill: (skillRef: string) => void;
  onManageSkill: (skillRef: string) => Promise<void>;
}

export function SkillsNeedsReviewList({
  rows,
  pendingStructuralActions,
  bulkActionPending,
  selectedSkillRef,
  onOpenSkill,
  onManageSkill,
}: SkillsNeedsReviewListProps) {
  return (
    <section className="needs-review-rows" aria-label="Skills to review list">
      {rows.map((row) => (
        <SkillNeedsReviewCard
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
