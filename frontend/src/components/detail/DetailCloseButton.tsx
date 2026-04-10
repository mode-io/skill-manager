import { X } from "lucide-react";

interface DetailCloseButtonProps {
  onClick: () => void;
  ariaLabel?: string;
}

export function DetailCloseButton({ onClick, ariaLabel = "Close detail view" }: DetailCloseButtonProps) {
  return (
    <button
      type="button"
      className="skill-detail__close-button"
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <X size={14} aria-hidden="true" />
    </button>
  );
}
