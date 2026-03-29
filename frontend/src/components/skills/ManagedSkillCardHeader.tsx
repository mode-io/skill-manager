import type { SkillTableRow } from "../../api/types";
import { skillStatusTone } from "../ui/statusMappings";
import { SkillStatusIndicator } from "./SkillStatusIndicator";

interface ManagedSkillCardHeaderProps {
  row: SkillTableRow;
  onOpenSkill: (skillRef: string) => void;
}

export function ManagedSkillCardHeader({
  row,
  onOpenSkill,
}: ManagedSkillCardHeaderProps) {
  return (
    <div className="skill-card__header">
      <div className="skill-card__identity">
        <div className="skill-card__title-row">
          <button
            type="button"
            className="skill-card__name"
            onClick={(event) => {
              event.stopPropagation();
              onOpenSkill(row.skillRef);
            }}
            aria-label={`Open details for ${row.name}`}
          >
            {row.name}
          </button>
          {row.displayStatus !== "Managed" && (
            <SkillStatusIndicator
              status={row.displayStatus}
              tone={skillStatusTone(row.displayStatus)}
              attentionMessage={row.attentionMessage}
            />
          )}
        </div>
      </div>
    </div>
  );
}
