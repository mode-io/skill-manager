import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import { UiTooltip, type UiTooltipProps } from "./UiTooltip";

interface UiTooltipTriggerBoundaryProps extends Omit<UiTooltipProps, "children"> {
  children: ReactNode;
  className?: string;
}

export function UiTooltipTriggerBoundary({
  children,
  className,
  content,
  disabled,
  contentClassName,
  side,
  align,
  sideOffset,
  collisionPadding,
  delayDuration,
}: UiTooltipTriggerBoundaryProps) {
  const classes = className
    ? `ui-tooltip-trigger ${className}`
    : "ui-tooltip-trigger";

  function handleClick(event: MouseEvent<HTMLSpanElement>) {
    event.stopPropagation();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <UiTooltip
      content={content}
      disabled={disabled}
      contentClassName={contentClassName}
      side={side}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      delayDuration={delayDuration}
    >
      <span
        className={classes}
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {children}
      </span>
    </UiTooltip>
  );
}
