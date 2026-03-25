import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

interface AppShellProps {
  children: ReactNode;
  settingsControl: ReactNode;
}

export function AppShell({ children, settingsControl }: AppShellProps): JSX.Element {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <p className="app-header__eyebrow">Universal Skill Manager</p>
          <h1 className="app-header__title">skill-manager</h1>
        </div>
        <nav className="app-header__nav" aria-label="Primary">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
            <span className="nav-link__label">Skills</span>
          </NavLink>
          <NavLink to="/marketplace" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
            <span className="nav-link__label">Marketplace</span>
          </NavLink>
        </nav>
        {settingsControl}
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
