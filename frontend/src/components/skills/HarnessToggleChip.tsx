import * as SwitchPrimitive from "@radix-ui/react-switch";

interface HarnessToggleChipProps {
  checked: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onCheckedChange: (checked: boolean) => void;
}

export function HarnessToggleChip({
  checked,
  disabled = false,
  ariaLabel,
  onCheckedChange,
}: HarnessToggleChipProps) {
  return (
    <SwitchPrimitive.Root
      className="harness-toggle-chip"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      onCheckedChange={onCheckedChange}
    >
      <span className="harness-toggle-chip__label" aria-hidden="true">
        {checked ? "On" : "Off"}
      </span>
    </SwitchPrimitive.Root>
  );
}
