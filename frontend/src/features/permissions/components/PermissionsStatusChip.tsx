interface PermissionsStatusChipProps {
  decision: string;
  scope: string;
}

export function PermissionsStatusChip({ decision, scope }: PermissionsStatusChipProps) {
  return (
    <span
      className="chip permission-event-chip"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: 500,
        backgroundColor: decision === "allow" ? "rgba(16, 185, 129, 0.15)" : decision === "deny" ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)",
        color: decision === "allow" ? "rgb(16, 185, 129)" : decision === "deny" ? "rgb(239, 68, 68)" : "rgb(245, 158, 11)",
        border: decision === "allow" ? "1px solid rgba(16, 185, 129, 0.3)" : decision === "deny" ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
      }}
    >
      {decision}: {scope}
    </span>
  );
}
