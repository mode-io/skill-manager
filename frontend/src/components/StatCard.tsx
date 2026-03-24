import type { ElementType } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  status?: "ok" | "warning" | "error";
  icon?: ElementType;
}

export function StatCard({ label, value, status, icon: Icon }: StatCardProps): JSX.Element {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={status ? { color: `var(--color-${status})` } : undefined}>
        {Icon && <Icon style={{ width: 20, height: 20, display: "inline", verticalAlign: "middle", marginRight: 6 }} />}
        {value}
      </span>
    </div>
  );
}
