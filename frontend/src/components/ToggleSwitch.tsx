import * as SwitchPrimitive from "@radix-ui/react-switch";

interface ToggleSwitchProps {
  checked: boolean;
  disabled?: boolean;
  label: string;
  ariaLabel?: string;
  pendingLabel?: string;
  onCheckedChange?: (checked: boolean) => void;
}

export function ToggleSwitch({
  checked,
  disabled = false,
  label,
  ariaLabel,
  pendingLabel,
  onCheckedChange,
}: ToggleSwitchProps) {
  const renderedLabel = disabled && pendingLabel ? pendingLabel : label;

  return (
    <label className={`toggle-switch ${disabled ? "toggle-switch--pending" : ""}`}>
      <span className="toggle-switch__label">{renderedLabel}</span>
      <SwitchPrimitive.Root
        className="toggle-switch__root"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel ?? renderedLabel}
        onCheckedChange={onCheckedChange}
      >
        <SwitchPrimitive.Thumb className="toggle-switch__thumb" />
      </SwitchPrimitive.Root>
    </label>
  );
}
