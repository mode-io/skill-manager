import { createContext, type ReactNode } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";

export const DEFAULT_TOOLTIP_DELAY_DURATION = 200;
export const DEFAULT_TOOLTIP_SKIP_DELAY_DURATION = 120;
export const UiTooltipContext = createContext(false);

interface UiTooltipProviderProps {
  children: ReactNode;
  delayDuration?: number;
  skipDelayDuration?: number;
}

export function UiTooltipProvider({
  children,
  delayDuration = DEFAULT_TOOLTIP_DELAY_DURATION,
  skipDelayDuration = DEFAULT_TOOLTIP_SKIP_DELAY_DURATION,
}: UiTooltipProviderProps) {
  return (
    <UiTooltipContext.Provider value={true}>
      <Tooltip.Provider
        delayDuration={delayDuration}
        skipDelayDuration={skipDelayDuration}
      >
        {children}
      </Tooltip.Provider>
    </UiTooltipContext.Provider>
  );
}
