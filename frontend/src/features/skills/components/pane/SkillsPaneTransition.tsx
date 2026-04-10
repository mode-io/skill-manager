import type { ReactNode } from "react";

export type SkillsPaneView = "managed" | "unmanaged";
export type SkillsPaneDirection = "forward" | "backward";

interface SkillsPaneTransitionProps {
  view: SkillsPaneView;
  direction: SkillsPaneDirection;
  animate?: boolean;
  children: ReactNode;
}

export function SkillsPaneTransition({ view, direction, animate = true, children }: SkillsPaneTransitionProps) {
  return (
    <div
      key={view}
      className={`skills-pane-transition${animate ? ` skills-pane-transition--${direction}` : ""}`}
      data-view={view}
    >
      {children}
    </div>
  );
}
