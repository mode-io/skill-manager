type BadgeVariant = "ok" | "warning" | "error" | "shared" | "unmanaged" | "builtin";

interface StatusBadgeProps {
  variant: BadgeVariant;
  label?: string;
}

export function StatusBadge({ variant, label }: StatusBadgeProps): JSX.Element {
  return <span className={`badge badge-${variant}`}>{label ?? variant}</span>;
}
