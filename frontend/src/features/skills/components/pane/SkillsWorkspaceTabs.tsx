import { NavLink } from "react-router-dom";

import type { SkillsSummary } from "../../model/types";

interface SkillsWorkspaceTabsProps {
  summary: SkillsSummary | null;
}

export function SkillsWorkspaceTabs({ summary }: SkillsWorkspaceTabsProps) {
  const managedCount = summary ? summary.managed + summary.custom : 0;
  const unmanagedCount = summary?.unmanaged ?? 0;

  return (
    <nav className="skills-workspace__tabs" aria-label="Skills views">
      <NavLink to="/skills/managed" className={({ isActive }) => `skills-workspace__tab${isActive ? " is-active" : ""}`}>
        <span className="skills-workspace__tab-label">Managed</span>
        <span className="skills-workspace__tab-count">{managedCount}</span>
      </NavLink>
      <NavLink to="/skills/unmanaged" className={({ isActive }) => `skills-workspace__tab${isActive ? " is-active" : ""}`}>
        <span className="skills-workspace__tab-label">Unmanaged</span>
        <span className="skills-workspace__tab-count">{unmanagedCount}</span>
      </NavLink>
    </nav>
  );
}
