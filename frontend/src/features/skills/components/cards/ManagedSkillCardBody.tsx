import type { SkillListRow } from "../../model/types";

interface ManagedSkillCardBodyProps {
  row: SkillListRow;
}

export function ManagedSkillCardBody({ row }: ManagedSkillCardBodyProps) {
  return (
    <div className="skill-card__body">
      <p className="skill-card__description">{row.description || "No description provided."}</p>
    </div>
  );
}
