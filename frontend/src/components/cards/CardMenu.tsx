import { type ReactNode, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { MoreHorizontal } from "lucide-react";

export interface CardMenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface CardMenuProps {
  label: string;
  items: readonly CardMenuItem[];
  disabled?: boolean;
}

/**
 * 3-dot icon button + shared popup menu surface used on in-use cards.
 */
export function CardMenu({ label, items, disabled = false }: CardMenuProps) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) {
    return null;
  }
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="card-icon-button"
          aria-label={label}
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal size={14} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="ui-popup ui-popup--menu ui-menu"
          align="end"
          sideOffset={6}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <ul className="ui-menu__list">
            {items.map((item) => (
              <li key={item.key}>
                <Popover.Close asChild>
                  <button
                    type="button"
                    className="ui-menu__item"
                    data-destructive={item.destructive || undefined}
                    disabled={item.disabled}
                    onClick={(event) => {
                      event.stopPropagation();
                      item.onSelect();
                    }}
                  >
                    {item.icon ? (
                      <span className="ui-menu__icon" aria-hidden="true">
                        {item.icon}
                      </span>
                    ) : (
                      <span className="ui-menu__icon" aria-hidden="true" />
                    )}
                    <span className="ui-menu__label">{item.label}</span>
                    <span className="ui-menu__meta" aria-hidden="true" />
                  </button>
                </Popover.Close>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
