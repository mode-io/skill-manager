import type { SkillTableRow } from "../../api/types";

interface ManagedSkillCardBodyProps {
  row: SkillTableRow;
}

export function ManagedSkillCardBody({ row }: ManagedSkillCardBodyProps): JSX.Element {
  return (
    <div className="skill-card__body">
      <p className="skill-card__description">{row.description || "No description provided."}</p>
    </div>
  );
}
