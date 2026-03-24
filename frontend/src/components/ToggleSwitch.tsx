import { Check } from "lucide-react";

interface ToggleSwitchProps {
  harnessLabel: string;
  enabled: boolean;
  disabled?: boolean;
  loading?: boolean;
  onToggle: () => void;
}

export function ToggleSwitch({ harnessLabel, enabled, disabled, loading, onToggle }: ToggleSwitchProps): JSX.Element {
  return (
    <div className="toggle-row">
      <span className="toggle-label">{harnessLabel}</span>
      {loading ? (
        <span className="spinner spinner-sm" role="status" aria-label={`Toggling ${harnessLabel}`} />
      ) : (
        <button
          className={`checkbox${enabled ? " checked" : ""}`}
          role="checkbox"
          aria-checked={enabled}
          aria-label={`${enabled ? "Disable" : "Enable"} in ${harnessLabel}`}
          disabled={disabled}
          onClick={onToggle}
        >
          {enabled && <Check size={12} />}
        </button>
      )}
    </div>
  );
}
