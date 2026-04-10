import { type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";

import { useHoverSurfaceState } from "./useHoverSurfaceState";

interface HoverTooltipProps {
  copy: string;
  children: ReactNode;
  disabled?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  collisionPadding?: number;
}

export function HoverTooltip({
  copy,
  children,
  disabled = false,
  side = "top",
  align = "center",
  sideOffset = 8,
  collisionPadding = 16,
}: HoverTooltipProps) {
  const hover = useHoverSurfaceState();

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <Popover.Root open={hover.open} onOpenChange={hover.setOpen}>
      <Popover.Trigger asChild>
        <span {...hover.triggerProps}>
          {children}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className="ui-hover-tooltip"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          {...hover.contentProps}
        >
          <p className="ui-hover-tooltip__copy">{copy}</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
