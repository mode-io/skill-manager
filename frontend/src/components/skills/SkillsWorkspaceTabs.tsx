import { NavLink } from "react-router-dom";

import type { SkillsSummary } from "../../api/types";

interface SkillsWorkspaceTabsProps {
  summary: SkillsSummary | null;
}

export function SkillsWorkspaceTabs({ summary }: SkillsWorkspaceTabsProps): JSX.Element {
  const managedCount = summary ? summary.managed + summary.custom : 0;
  const foundLocalCount = summary?.foundLocally ?? 0;

  return (
    <nav className="skills-workspace__tabs" aria-label="Skills views">
      <NavLink to="/skills/managed" className={({ isActive }) => `skills-workspace__tab${isActive ? " is-active" : ""}`}>
        <span className="skills-workspace__tab-label">Managed</span>
        <span className="skills-workspace__tab-count">{managedCount}</span>
      </NavLink>
      <NavLink to="/skills/found-local" className={({ isActive }) => `skills-workspace__tab${isActive ? " is-active" : ""}`}>
        <span className="skills-workspace__tab-label">Found locally</span>
        <span className="skills-workspace__tab-count">{foundLocalCount}</span>
      </NavLink>
    </nav>
  );
}
