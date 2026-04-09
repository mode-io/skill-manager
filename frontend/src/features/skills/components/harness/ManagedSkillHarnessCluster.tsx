import type { HarnessCell, HarnessColumn, SkillListRow } from "../../model/types";
import { alignHarnessCells } from "../../model/selectors";
import { HarnessMark } from "./HarnessMark";
import { HarnessStateChip } from "./HarnessStateChip";

interface ManagedSkillHarnessClusterProps {
  row: SkillListRow;
  columns: HarnessColumn[];
  busyId: string | null;
  onToggleCell: (row: SkillListRow, cell: HarnessCell) => void;
}

export function ManagedSkillHarnessCluster({
  row,
  columns,
  busyId,
  onToggleCell,
}: ManagedSkillHarnessClusterProps) {
  const items = alignHarnessCells(row, columns);

  return (
    <div
      className="skill-harness-cluster skill-card__harnesses"
      aria-label={`Harness toggles for ${row.name}`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="skill-harness-cluster__items">
        {items.map(({ column, cell }) => (
          <div key={`${row.skillRef}:${column.harness}`} className="skill-harness-cluster__item">
            <HarnessMark
              harness={column.harness}
              label={column.label}
              className="skill-harness-cluster__tool"
            />
            <div className="skill-harness-cluster__control">
              <ManagedHarnessClusterControl
                row={row}
                cell={cell ?? { harness: column.harness, label: column.label, state: "empty", interactive: false }}
                busyId={busyId}
                onToggleCell={onToggleCell}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ManagedHarnessClusterControlProps {
  row: SkillListRow;
  cell: HarnessCell;
  busyId: string | null;
  onToggleCell: (row: SkillListRow, cell: HarnessCell) => void;
}

function ManagedHarnessClusterControl({
  row,
  cell,
  busyId,
  onToggleCell,
}: ManagedHarnessClusterControlProps) {
  return (
    <HarnessStateChip
      state={cell.state}
      interactive={cell.interactive}
      disabled={busyId !== null}
      ariaLabel={`${cell.state === "enabled" ? "Disable" : "Enable"} ${row.name} for ${cell.label}`}
      onCheckedChange={() => onToggleCell(row, cell)}
    />
  );
}
