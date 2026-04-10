import { type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";

import { useHoverSurfaceState } from "./useHoverSurfaceState";

interface HelpPopoverProps {
  title: string;
  copy: string;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  collisionPadding?: number;
}

export function HelpPopover({
  title,
  copy,
  children,
  side = "bottom",
  align = "center",
  sideOffset = 8,
  collisionPadding = 16,
}: HelpPopoverProps) {
  const hover = useHoverSurfaceState();

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
          className="skills-help-popover"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          {...hover.contentProps}
        >
          <p className="skills-help-popover__title">{title}</p>
          <p className="skills-help-popover__copy">{copy}</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
