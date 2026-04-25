import { UiTooltip } from "../../../../components/ui/UiTooltip";
import { UiTooltipTriggerBoundary } from "../../../../components/ui/UiTooltipTriggerBoundary";
import type { SkillRemoveStatus } from "../../model/types";

interface SkillDetailRemoveActionProps {
  status: SkillRemoveStatus;
  disabled: boolean;
  onRequestRemove: () => void;
}

export function SkillDetailRemoveAction({
  status,
  disabled,
  onRequestRemove,
}: SkillDetailRemoveActionProps) {
  const isBlocked = disabled || status === "disabled_no_enabled";

  const copy = status === "disabled_no_enabled"
    ? "Enable at least one harness before removing this skill from Skill Manager."
    : "Removes this skill from the Skill Manager store and restores local copies only for the harnesses that are currently enabled.";

  const button = (
    <button
      type="button"
      className="action-pill action-pill--md"
      disabled={isBlocked}
      onClick={status === "available" ? () => {
        onRequestRemove();
      } : undefined}
    >
      Remove from Skill Manager
    </button>
  );

  if (isBlocked) {
    return (
      <UiTooltipTriggerBoundary
        content={copy}
        contentClassName="ui-popup--tooltip--hint"
        align="end"
      >
        {button}
      </UiTooltipTriggerBoundary>
    );
  }

  return (
    <UiTooltip content={copy} contentClassName="ui-popup--tooltip--hint" align="end">
      {button}
    </UiTooltip>
  );
}
