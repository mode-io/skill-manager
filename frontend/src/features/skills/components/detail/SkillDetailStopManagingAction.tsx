import * as Popover from "@radix-ui/react-popover";
import { useEffect, useRef, useState } from "react";

import type { SkillStopManagingStatus } from "../../model/types";

const HOVER_CLOSE_DELAY_MS = 100;

interface SkillDetailStopManagingActionProps {
  status: SkillStopManagingStatus;
  disabled: boolean;
  onRequestStopManaging: () => void;
}

export function SkillDetailStopManagingAction({
  status,
  disabled,
  onRequestStopManaging,
}: SkillDetailStopManagingActionProps) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const isBlocked = disabled || status === "disabled_no_enabled";

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

  const copy = status === "disabled_no_enabled"
    ? "Turn on at least one harness before moving this skill back to unmanaged."
    : "Moves this skill out of the shared managed store and restores local copies only for the harnesses that are currently enabled.";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <span
          className="skill-detail__action-trigger"
          tabIndex={status === "disabled_no_enabled" ? 0 : -1}
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
          <button
            type="button"
            className="btn btn-secondary"
            disabled={isBlocked}
            onClick={status === "available" ? () => {
              setOpen(false);
              onRequestStopManaging();
            } : undefined}
          >
            Stop Managing
          </button>
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={16}
          className="skills-help-popover"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <p className="skills-help-popover__title">Stop managing</p>
          <p className="skills-help-popover__copy">{copy}</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
