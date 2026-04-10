import type { ReactNode } from "react";
import { Settings } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import { LoadingSpinner } from "./LoadingSpinner";

interface AppShellProps {
  children: ReactNode;
  onRefreshData?: () => void | Promise<void>;
  refreshPending?: boolean;
}

export function AppShell({ children, onRefreshData, refreshPending = false }: AppShellProps) {
  const location = useLocation();
  const isSkillsRoute = location.pathname.startsWith("/skills");

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <p className="app-header__eyebrow">Universal Skill Manager</p>
          <h1 className="app-header__title">skill-manager</h1>
        </div>
        <nav className="app-header__nav" aria-label="Primary">
          <NavLink to="/skills" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
            <span className="nav-link__label">Skills</span>
          </NavLink>
          <NavLink to="/marketplace" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
            <span className="nav-link__label">Marketplace</span>
          </NavLink>
        </nav>
        <div className="app-header__actions">
          <button
            type="button"
            className="nav-link app-header__refresh"
            onClick={() => void onRefreshData?.()}
            disabled={refreshPending}
            aria-busy={refreshPending}
          >
            {refreshPending ? <LoadingSpinner size="sm" label="Refreshing data" /> : null}
            <span className="nav-link__label">{refreshPending ? "Refreshing..." : "Refresh Data"}</span>
          </button>
          <NavLink
            to="/settings"
            className={({ isActive }) => `icon-button app-header__settings${isActive ? " is-active" : ""}`}
            aria-label="Open settings"
          >
            <Settings size={18} />
          </NavLink>
        </div>
      </header>
      <main className={`app-main${isSkillsRoute ? " app-main--skills" : ""}`}>{children}</main>
    </div>
  );
}
