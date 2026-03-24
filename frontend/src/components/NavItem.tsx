import { NavLink } from "react-router-dom";
import type { ElementType } from "react";

interface NavItemProps {
  to: string;
  icon: ElementType;
  label: string;
}

export function NavItem({ to, icon: Icon, label }: NavItemProps): JSX.Element {
  return (
    <NavLink to={to} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`} end>
      <Icon />
      <span>{label}</span>
    </NavLink>
  );
}
