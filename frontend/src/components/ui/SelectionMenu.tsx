import type { ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ListFilter } from "lucide-react";

export interface SelectionMenuOption<T extends string> {
  value: T;
  label: string;
  meta?: ReactNode;
}

interface SelectionMenuProps<T extends string> {
  value: T;
  options: readonly SelectionMenuOption<T>[];
  active: boolean;
  ariaLabel: string;
  onChange: (next: T) => void;
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

export function SelectionMenu<T extends string>({
  value,
  options,
  active,
  ariaLabel,
  onChange,
  align = "end",
  sideOffset = 6,
}: SelectionMenuProps<T>) {
  const activeLabel = options.find((option) => option.value === value)?.label ?? "";

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="filter-trigger"
          data-active={active || undefined}
          aria-label={ariaLabel}
        >
          <ListFilter size={16} />
          {active && activeLabel ? (
            <span className="filter-trigger__label">{activeLabel}</span>
          ) : null}
          {active ? <span className="filter-trigger__dot" aria-hidden="true" /> : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="ui-popup ui-popup--menu ui-menu" align={align} sideOffset={sideOffset}>
          <ul className="ui-menu__list">
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <li key={option.value}>
                  <Popover.Close asChild>
                    <button
                      type="button"
                      className="ui-menu__item"
                      data-selected={selected || undefined}
                      onClick={() => onChange(option.value)}
                    >
                      <span className="ui-menu__icon" aria-hidden="true">
                        {selected ? <Check size={14} /> : null}
                      </span>
                      <span className="ui-menu__label">{option.label}</span>
                      {option.meta !== undefined ? (
                        <span className="ui-menu__meta">{option.meta}</span>
                      ) : null}
                    </button>
                  </Popover.Close>
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
