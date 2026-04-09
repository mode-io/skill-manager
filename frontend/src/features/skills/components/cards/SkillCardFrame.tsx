import type { ReactNode } from "react";

interface SkillCardFrameProps {
  variant: "managed" | "unmanaged";
  selected: boolean;
  onOpenSkill: () => void;
  content: ReactNode;
  aside: ReactNode;
}

export function SkillCardFrame({
  variant,
  selected,
  onOpenSkill,
  content,
  aside,
}: SkillCardFrameProps) {
  return (
    <article
      className={`skill-card skill-card--${variant}${selected ? " is-selected" : ""}`}
      onClick={onOpenSkill}
    >
      <div className="skill-card__content">{content}</div>
      <div className="skill-card__aside">{aside}</div>
    </article>
  );
}
