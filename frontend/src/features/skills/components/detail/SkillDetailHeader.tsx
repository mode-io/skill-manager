import type { ReactNode } from "react";

import { SkillDetailCloseButton } from "./SkillDetailCloseButton";

interface SkillDetailHeaderProps {
  title: ReactNode;
  onClose: () => void;
  titleAction?: ReactNode;
  meta?: ReactNode;
  utility?: ReactNode;
  eyebrow?: string | null;
}

export function SkillDetailHeader({
  title,
  onClose,
  titleAction,
  meta,
  utility,
  eyebrow = "Skill details",
}: SkillDetailHeaderProps) {
  return (
    <div className="skill-detail__header">
      <div className="skill-detail__header-top">
        {eyebrow ? <p className="skill-detail__eyebrow">{eyebrow}</p> : null}
        <div className="skill-detail__utility-rail">
          {utility ? <div className="skill-detail__utility-content">{utility}</div> : null}
          <SkillDetailCloseButton onClick={onClose} />
        </div>
      </div>
      <div className="skill-detail__title-stack">
        <div className="skill-detail__title-row">
          <div className="skill-detail__title-copy">{title}</div>
          {titleAction ? <div className="skill-detail__title-action">{titleAction}</div> : null}
        </div>
        {meta ? <div className="skill-detail__meta-row">{meta}</div> : null}
      </div>
    </div>
  );
}
