import {
  createElement,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";

import { UiTooltip, type UiTooltipProps } from "./UiTooltip";

type OverflowTooltipTag = "span" | "p" | "h3" | "code";

interface OverflowTooltipTextProps
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  as?: OverflowTooltipTag;
  children: ReactNode;
  tooltipContent?: ReactNode;
  disabled?: boolean;
  side?: UiTooltipProps["side"];
  align?: UiTooltipProps["align"];
  sideOffset?: UiTooltipProps["sideOffset"];
}

export function OverflowTooltipText({
  as = "span",
  children,
  tooltipContent,
  disabled = false,
  side = "top",
  align = "center",
  sideOffset = 6,
  ...rest
}: OverflowTooltipTextProps) {
  const elementRef = useRef<HTMLElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    let frame = 0;

    const measure = () => {
      const next =
        element.scrollWidth > element.clientWidth + 1 ||
        element.scrollHeight > element.clientHeight + 1;
      setOverflowing((current) => (current === next ? current : next));
    };

    const scheduleMeasure = () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    scheduleMeasure();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleMeasure);
    resizeObserver?.observe(element);
    if (element.parentElement) {
      resizeObserver?.observe(element.parentElement);
    }

    window.addEventListener("resize", scheduleMeasure);
    const fontFaceSet =
      typeof document === "undefined" || !("fonts" in document)
        ? null
        : document.fonts;
    fontFaceSet?.addEventListener?.("loadingdone", scheduleMeasure);

    return () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      fontFaceSet?.removeEventListener?.("loadingdone", scheduleMeasure);
    };
  }, [children, tooltipContent]);

  const element = createElement(as, {
    ...rest,
    ref: (node: HTMLElement | null) => {
      elementRef.current = node;
    },
  }, children);

  return (
    <UiTooltip
      content={tooltipContent ?? children}
      disabled={disabled || !overflowing}
      side={side}
      align={align}
      sideOffset={sideOffset}
    >
      {element}
    </UiTooltip>
  );
}
