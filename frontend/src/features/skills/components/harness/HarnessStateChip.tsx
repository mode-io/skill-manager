import * as SwitchPrimitive from "@radix-ui/react-switch";

import type { HarnessCellState } from "../../model/types";

interface HarnessStateChipProps {
  state: HarnessCellState;
  interactive: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  onCheckedChange?: (checked: boolean) => void;
}

export function HarnessStateChip({
  state,
  interactive,
  disabled = false,
  ariaLabel,
  onCheckedChange,
}: HarnessStateChipProps) {
  if (interactive && (state === "enabled" || state === "disabled")) {
    const checked = state === "enabled";
    return (
      <SwitchPrimitive.Root
        className="harness-state-chip"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onCheckedChange={onCheckedChange}
      >
        <span className="harness-state-chip__label" aria-hidden="true">
          {checked ? "On" : "Off"}
        </span>
      </SwitchPrimitive.Root>
    );
  }

  const passiveState = passiveChipPresentation(state);
  return (
    <span
      className={`harness-state-chip harness-state-chip--static harness-state-chip--${passiveState.variant}`}
    >
      <span className="harness-state-chip__label">{passiveState.label}</span>
    </span>
  );
}

function passiveChipPresentation(
  state: HarnessCellState,
): { label: string; variant: "found" | "empty" | "builtin" } {
  switch (state) {
    case "found":
      return { label: "Found", variant: "found" };
    case "builtin":
      return { label: "Built-in", variant: "builtin" };
    case "empty":
    default:
      return { label: "Not Found", variant: "empty" };
  }
}
