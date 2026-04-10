import { hasPendingToggleForCell, type CellActionKey } from "../../model/pending";
import type { HarnessCell, HarnessColumn, SkillListRow } from "../../model/types";
import { alignHarnessCells } from "../../model/selectors";
import { HarnessMark } from "./HarnessMark";
import { HarnessStateChip } from "./HarnessStateChip";

interface ManagedSkillHarnessClusterProps {
  row: SkillListRow;
  columns: HarnessColumn[];
  pendingToggleKeys: ReadonlySet<CellActionKey>;
  structuralLocked: boolean;
  onToggleCell: (row: SkillListRow, cell: HarnessCell) => void;
}

export function ManagedSkillHarnessCluster({
  row,
  columns,
  pendingToggleKeys,
  structuralLocked,
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
              logoKey={cell?.logoKey ?? column.logoKey}
              className="skill-harness-cluster__tool"
            />
            <div className="skill-harness-cluster__control">
              <ManagedHarnessClusterControl
                row={row}
                cell={cell ?? {
                  harness: column.harness,
                  label: column.label,
                  logoKey: column.logoKey,
                  state: "empty",
                  interactive: false,
                }}
                pendingToggleKeys={pendingToggleKeys}
                structuralLocked={structuralLocked}
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
  pendingToggleKeys: ReadonlySet<CellActionKey>;
  structuralLocked: boolean;
  onToggleCell: (row: SkillListRow, cell: HarnessCell) => void;
}

function ManagedHarnessClusterControl({
  row,
  cell,
  pendingToggleKeys,
  structuralLocked,
  onToggleCell,
}: ManagedHarnessClusterControlProps) {
  const pending = hasPendingToggleForCell(pendingToggleKeys, row.skillRef, cell.harness);

  return (
    <HarnessStateChip
      state={cell.state}
      interactive={cell.interactive}
      disabled={structuralLocked}
      pending={pending}
      ariaLabel={`${cell.state === "enabled" ? "Disable" : "Enable"} ${row.name} for ${cell.label}`}
      onCheckedChange={() => onToggleCell(row, cell)}
    />
  );
}
