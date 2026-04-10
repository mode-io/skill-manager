import type { ReactNode } from "react";

interface SkillCardHeaderProps {
  name: string;
  skillRef: string;
  onOpenSkill: (skillRef: string) => void;
  statusSlot?: ReactNode;
}

export function SkillCardHeader({
  name,
  skillRef,
  onOpenSkill,
  statusSlot,
}: SkillCardHeaderProps) {
  return (
    <div className="skill-card__header">
      <div className="skill-card__identity">
        <div className="skill-card__title-row">
          <button
            type="button"
            className="skill-card__name"
            onClick={(event) => {
              event.stopPropagation();
              onOpenSkill(skillRef);
            }}
            aria-label={`Open details for ${name}`}
          >
            {name}
          </button>
          {statusSlot}
        </div>
      </div>
    </div>
  );
}
