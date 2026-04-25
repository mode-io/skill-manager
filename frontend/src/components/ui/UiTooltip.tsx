import { useContext, type ReactElement, type ReactNode } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";

import {
  DEFAULT_TOOLTIP_DELAY_DURATION,
  DEFAULT_TOOLTIP_SKIP_DELAY_DURATION,
  UiTooltipContext,
  UiTooltipProvider,
} from "./UiTooltipProvider";

export interface UiTooltipProps {
  content: ReactNode;
  children: ReactElement;
  disabled?: boolean;
  contentClassName?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  collisionPadding?: number;
  delayDuration?: number;
}

export function UiTooltip({
  content,
  children,
  disabled = false,
  contentClassName,
  side = "top",
  align = "center",
  sideOffset = 6,
  collisionPadding = 16,
  delayDuration,
}: UiTooltipProps) {
  if (disabled || content === null || content === undefined || content === "") {
    return children;
  }

  const hasProvider = useContext(UiTooltipContext);
  const tooltipClassName = contentClassName
    ? `ui-popup ui-popup--tooltip ${contentClassName}`
    : "ui-popup ui-popup--tooltip";

  const tooltip = (
    <Tooltip.Root delayDuration={delayDuration}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className={tooltipClassName}
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
        >
          {content}
          <Tooltip.Arrow className="ui-popup__arrow" width={10} height={5} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );

  if (hasProvider) {
    return tooltip;
  }

  return (
    <UiTooltipProvider
      delayDuration={delayDuration ?? DEFAULT_TOOLTIP_DELAY_DURATION}
      skipDelayDuration={DEFAULT_TOOLTIP_SKIP_DELAY_DURATION}
    >
      {tooltip}
    </UiTooltipProvider>
  );
}
