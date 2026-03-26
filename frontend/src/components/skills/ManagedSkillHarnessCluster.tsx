import type { HarnessCell, HarnessColumn, SkillTableRow } from "../../api/types";
import { StatusBadge } from "../ui/StatusBadge";
import { Switch } from "../ui/Switch";
import { passiveHarnessStateBadge } from "../ui/statusMappings";
import { alignHarnessCells } from "./model";

interface ManagedSkillHarnessClusterProps {
  row: SkillTableRow;
  columns: HarnessColumn[];
  busyId: string | null;
  onToggleCell: (row: SkillTableRow, cell: HarnessCell) => void;
}

export function ManagedSkillHarnessCluster({
  row,
  columns,
  busyId,
  onToggleCell,
}: ManagedSkillHarnessClusterProps): JSX.Element {
  const items = alignHarnessCells(row, columns);

  return (
    <div className="skill-harness-cluster skill-card__harnesses" aria-label={`Harness toggles for ${row.name}`}>
      <div className="skill-harness-cluster__items">
        {items.map(({ column, cell }) => (
          <div key={`${row.skillRef}:${column.harness}`} className="skill-harness-cluster__item">
            <span className="skill-harness-cluster__tool">{column.label}</span>
            <div className="skill-harness-cluster__control">
              {cell ? (
                <ManagedHarnessClusterControl
                  row={row}
                  cell={cell}
                  busyId={busyId}
                  onToggleCell={onToggleCell}
                />
              ) : (
                <span className="skill-harness-cluster__empty">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ManagedHarnessClusterControlProps {
  row: SkillTableRow;
  cell: HarnessCell;
  busyId: string | null;
  onToggleCell: (row: SkillTableRow, cell: HarnessCell) => void;
}

function ManagedHarnessClusterControl({
  row,
  cell,
  busyId,
  onToggleCell,
}: ManagedHarnessClusterControlProps): JSX.Element {
  const passiveState = passiveHarnessStateBadge(cell.state);

  if (!cell.interactive) {
    return passiveState ? (
      <StatusBadge label={passiveState.label} tone={passiveState.tone} />
    ) : (
      <span className="skill-harness-cluster__empty">—</span>
    );
  }

  const checked = cell.state === "enabled";

  return (
    <Switch
      checked={checked}
      disabled={busyId !== null}
      ariaLabel={`${checked ? "Disable" : "Enable"} ${row.name} for ${cell.label}`}
      onCheckedChange={() => onToggleCell(row, cell)}
    />
  );
}
