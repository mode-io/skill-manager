import { Outlet } from "react-router-dom";
import { Package, ScanLine, ShoppingBag, Activity } from "lucide-react";
import { NavItem } from "./NavItem";
import { useCatalog } from "../hooks/useCatalog";
import { LoadingSpinner } from "./LoadingSpinner";

export function Layout(): JSX.Element {
  const { status, errorMessage } = useCatalog();

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-brand">skill-manager</div>
        <div className="sidebar-nav">
          <NavItem to="/" icon={Package} label="My Skills" />
          <NavItem to="/setup" icon={ScanLine} label="Setup" />
          <NavItem to="/marketplace" icon={ShoppingBag} label="Marketplace" />
          <NavItem to="/system" icon={Activity} label="Health" />
        </div>
      </nav>
      <main className="content">
        {status === "loading" ? (
          <div className="empty-state"><LoadingSpinner size="lg" label="Loading control plane" /></div>
        ) : status === "error" ? (
          <div className="empty-state">
            <h3>Unable to load control plane</h3>
            <p>{errorMessage}</p>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
