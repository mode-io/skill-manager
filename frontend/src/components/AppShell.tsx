import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Settings } from "lucide-react";

interface AppShellProps {
  children: ReactNode;
  onOpenSettings: () => void;
}

export function AppShell({ children, onOpenSettings }: AppShellProps): JSX.Element {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <p className="app-header__eyebrow">Universal Skill Manager</p>
          <h1>skill-manager</h1>
        </div>
        <nav className="app-header__nav" aria-label="Primary">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
            Skills
          </NavLink>
          <NavLink to="/marketplace" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
            Marketplace
          </NavLink>
        </nav>
        <button type="button" className="icon-button" onClick={onOpenSettings} aria-label="Open settings">
          <Settings size={18} />
        </button>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
