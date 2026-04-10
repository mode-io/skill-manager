import { HelpPopover } from "../../../../components/ui/HelpPopover";
import type { SkillStopManagingStatus } from "../../model/types";

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
  const isBlocked = disabled || status === "disabled_no_enabled";

  const copy = status === "disabled_no_enabled"
    ? "Turn on at least one harness before moving this skill back to unmanaged."
    : "Moves this skill out of the shared managed store and restores local copies only for the harnesses that are currently enabled.";

  return (
    <HelpPopover title="Stop managing" copy={copy} align="end">
        <span
          className="skill-detail__action-trigger"
          tabIndex={status === "disabled_no_enabled" ? 0 : -1}
        >
          <button
            type="button"
            className="btn btn-secondary"
            disabled={isBlocked}
            onClick={status === "available" ? () => {
              onRequestStopManaging();
            } : undefined}
          >
            Stop Managing
          </button>
        </span>
    </HelpPopover>
  );
}
