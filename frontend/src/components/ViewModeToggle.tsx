import type { LucideIcon } from "lucide-react";

export interface ViewModeOption<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
}

interface ViewModeToggleProps<T extends string> {
  mode: T;
  options: readonly ViewModeOption<T>[];
  ariaLabel: string;
  onChange: (next: T) => void;
}

export function ViewModeToggle<T extends string>({
  mode,
  options,
  ariaLabel,
  onChange,
}: ViewModeToggleProps<T>) {
  return (
    <div className="view-mode-toggle" role="group" aria-label={ariaLabel}>
      {options.map(({ value, label, icon: Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            className="view-mode-toggle__btn"
            data-active={active}
            aria-pressed={active}
            onClick={() => onChange(value)}
          >
            <Icon size={15} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
