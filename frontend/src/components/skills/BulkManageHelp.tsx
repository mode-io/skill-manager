import { useEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";

const HOVER_CLOSE_DELAY_MS = 100;
const BULK_MANAGE_COPY =
  "Moves local copies into the Shared Store, then replaces tool-folder copies with managed links.";

export function BulkManageHelp() {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
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

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="btn btn-secondary skills-pane__help-trigger"
          aria-label="What happens when you manage all eligible skills"
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
          What happens?
        </button>
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
          <p className="skills-help-popover__title">Bulk manage</p>
          <p className="skills-help-popover__copy">{BULK_MANAGE_COPY}</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
