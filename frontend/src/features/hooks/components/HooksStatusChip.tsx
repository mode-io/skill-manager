interface HooksStatusChipProps {
  event: string;
}

export function HooksStatusChip({ event }: HooksStatusChipProps) {
  return (
    <span
      className="chip hook-event-chip"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: 500,
        backgroundColor: "rgba(212, 162, 127, 0.15)",
        color: "rgb(212, 162, 127)",
        border: "1px solid rgba(212, 162, 127, 0.3)",
      }}
    >
      {event}
    </span>
  );
}
