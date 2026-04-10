import { useEffect, useRef, useState } from "react";

const HOVER_CLOSE_DELAY_MS = 100;

export function useHoverSurfaceState() {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
  }, []);

  function cancelClose(): void {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function scheduleClose(): void {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, HOVER_CLOSE_DELAY_MS);
  }

  return {
    open,
    setOpen,
    triggerProps: {
      onMouseEnter: () => {
        cancelClose();
        setOpen(true);
      },
      onMouseLeave: scheduleClose,
      onFocus: () => {
        cancelClose();
        setOpen(true);
      },
      onBlur: scheduleClose,
    },
    contentProps: {
      onMouseEnter: cancelClose,
      onMouseLeave: scheduleClose,
    },
  };
}
