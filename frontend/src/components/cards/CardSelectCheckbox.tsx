import { type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

interface CardSelectCheckboxProps {
  checked: boolean;
  label: string;
  onToggle: () => void;
  disabled?: boolean;
}

/**
 * Square 14×14 select checkbox used on in-use cards (skills + mcp).
 * Stops propagation so it doesn't fire the card's click-to-open handler.
 */
export function CardSelectCheckbox({
  checked,
  label,
  onToggle,
  disabled = false,
}: CardSelectCheckboxProps) {
  function handleClick(event: ReactPointerEvent<HTMLSpanElement>): void {
    event.stopPropagation();
    if (disabled) return;
    onToggle();
  }
  function handleKey(event: KeyboardEvent<HTMLSpanElement>): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    onToggle();
  }

  return (
    <span
      className="card-select-checkbox"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={disabled || undefined}
      data-state={checked ? "checked" : "unchecked"}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={handleClick}
      onKeyDown={handleKey}
    >
      {checked ? (
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M3 8.5 6.5 12 13 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}
