import { useEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";

import type { SkillStatus } from "../../api/types";
import { StatusBadge, type StatusBadgeTone } from "../ui/StatusBadge";

interface SkillStatusIndicatorProps {
  status: SkillStatus;
  tone: StatusBadgeTone;
  attentionMessage: string | null;
}

const HOVER_CLOSE_DELAY_MS = 100;
const CUSTOM_STATUS_FALLBACK = "Modified locally. Source updates are disabled.";

export function SkillStatusIndicator({
  status,
  tone,
  attentionMessage,
}: SkillStatusIndicatorProps) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  if (status !== "Custom") {
    return <StatusBadge label={status} tone={tone} />;
  }

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

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`ui-status-badge ui-status-badge--${tone} skill-status-indicator__trigger`}
          aria-label={`${status} status details`}
          onClick={(event) => event.stopPropagation()}
          onMouseEnter={() => {
            cancelClose();
            setOpen(true);
          }}
          onMouseLeave={scheduleClose}
          onFocus={() => {
            cancelClose();
            setOpen(true);
          }}
          onBlur={scheduleClose}
        >
          {status}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="skill-status-popover"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <p className="skill-status-popover__title">Custom skill</p>
          <p className="skill-status-popover__copy">{attentionMessage ?? CUSTOM_STATUS_FALLBACK}</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
