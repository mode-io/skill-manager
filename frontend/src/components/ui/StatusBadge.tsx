export type StatusBadgeTone = "success" | "warning" | "neutral" | "muted";

interface StatusBadgeProps {
  label: string;
  tone: StatusBadgeTone;
}

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return <span className={`ui-status-badge ui-status-badge--${tone}`}>{label}</span>;
}
