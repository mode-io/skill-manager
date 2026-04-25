import {
  MatrixHarnessCellTarget,
  MatrixHarnessIcon,
} from "../../../../components/matrix";
import { UiTooltip } from "../../../../components/ui/UiTooltip";
import type { HarnessCell as HarnessCellType } from "../../model/types";

interface SkillMatrixHarnessCellProps {
  cell: HarnessCellType;
  skillName: string;
  pending?: boolean;
  onToggle: (cell: HarnessCellType) => void;
}

export function SkillMatrixHarnessCell({
  cell,
  skillName,
  pending = false,
  onToggle,
}: SkillMatrixHarnessCellProps) {
  if (cell.state === "empty" || cell.state === "found") {
    return (
      <span className="matrix-harness-target" data-state="empty" aria-hidden="true">
        —
      </span>
    );
  }

  const isEnabled = cell.state === "enabled";
  const action = isEnabled ? "Disable" : "Enable";

  const button = (
    <MatrixHarnessCellTarget
      ariaLabel={`${action} ${skillName} on ${cell.label}`}
      ariaPressed={isEnabled}
      state={cell.state}
      pending={pending}
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(cell);
      }}
    >
      <MatrixHarnessIcon
        label={cell.label}
        logoKey={cell.logoKey}
        harness={cell.harness}
      />
    </MatrixHarnessCellTarget>
  );

  return (
    <UiTooltip content={`${cell.label} — ${isEnabled ? "enabled" : "disabled"}`}>
      {button}
    </UiTooltip>
  );
}
