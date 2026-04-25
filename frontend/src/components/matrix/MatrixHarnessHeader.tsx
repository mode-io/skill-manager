import { UiTooltip } from "../ui/UiTooltip";
import { MatrixHarnessIcon } from "./MatrixHarnessIcon";

interface MatrixHarnessHeaderProps {
  label: string;
  logoKey?: string | null;
  harness?: string;
}

export function MatrixHarnessHeader({ label, logoKey, harness }: MatrixHarnessHeaderProps) {
  return (
    <th className="matrix-table__th matrix-table__th--harness">
      <UiTooltip content={label}>
        <span className="matrix-harness-target matrix-harness-target--header" aria-label={label}>
          <MatrixHarnessIcon label={label} logoKey={logoKey} harness={harness} />
        </span>
      </UiTooltip>
    </th>
  );
}
