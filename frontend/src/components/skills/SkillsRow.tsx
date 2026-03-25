import type { HarnessColumn, HarnessCell, SkillTableRow } from "../../api/types";
import { LoadingSpinner } from "../LoadingSpinner";
import { StatusBadge } from "../ui/StatusBadge";
import { Switch } from "../ui/Switch";
import { passiveHarnessStateBadge, skillStatusTone } from "../ui/statusMappings";

interface SkillsRowProps {
  row: SkillTableRow;
  columns: HarnessColumn[];
  busyId: string | null;
  onOpenSkill: (skillRef: string) => void;
  onToggleCell: (row: SkillTableRow, cell: HarnessCell) => void;
  onRunPrimaryAction: (row: SkillTableRow) => void;
}

export function SkillsRow({
  row,
  columns,
  busyId,
  onOpenSkill,
  onToggleCell,
  onRunPrimaryAction,
}: SkillsRowProps): JSX.Element {
  return (
    <tr className={`skills-table__row${row.needsAttention ? " is-attention" : ""}`}>
      <td className="skills-table__skill-cell">
        <div className="skills-row__skill">
          <button type="button" className="skills-row__name-button" onClick={() => onOpenSkill(row.skillRef)}>
            {row.name}
          </button>
          <p className="skills-row__description">{row.description || "No description provided."}</p>
        </div>
      </td>

      <td className="skills-table__status-cell">
        <div className="skills-row__status">
          <StatusBadge label={row.displayStatus} tone={skillStatusTone(row.displayStatus)} />
          {row.attentionMessage ? <p className="skills-row__attention">{row.attentionMessage}</p> : null}
        </div>
      </td>

      {columns.map((column) => {
        const cell = row.cells.find((item) => item.harness === column.harness);
        return (
          <td key={`${row.skillRef}:${column.harness}`} className="skills-table__tool-cell">
            {cell ? (
              <SkillsHarnessCell
                row={row}
                cell={cell}
                busyId={busyId}
                onToggleCell={onToggleCell}
              />
            ) : (
              <span className="skills-row__empty">—</span>
            )}
          </td>
        );
      })}

      <td className="skills-table__action-cell">
        <button
          type="button"
          className="btn btn-secondary skills-row__action"
          disabled={busyId !== null}
          onClick={() => onRunPrimaryAction(row)}
        >
          {busyId === `manage:${row.skillRef}` ? <LoadingSpinner size="sm" label={`Managing ${row.name}`} /> : null}
          {row.primaryAction.label}
        </button>
      </td>
    </tr>
  );
}

interface SkillsHarnessCellProps {
  row: SkillTableRow;
  cell: HarnessCell;
  busyId: string | null;
  onToggleCell: (row: SkillTableRow, cell: HarnessCell) => void;
}

function SkillsHarnessCell({ row, cell, busyId, onToggleCell }: SkillsHarnessCellProps): JSX.Element {
  const actionId = `${row.skillRef}:${cell.harness}`;
  const passiveState = passiveHarnessStateBadge(cell.state);

  if (!cell.interactive) {
    return passiveState ? (
      <StatusBadge label={passiveState.label} tone={passiveState.tone} />
    ) : (
      <span className="skills-row__empty">—</span>
    );
  }

  const checked = cell.state === "enabled";
  const loading = busyId === actionId;

  return (
    <div className="skills-row__switch">
      <Switch
        checked={checked}
        disabled={busyId !== null}
        ariaLabel={`${checked ? "Disable" : "Enable"} ${row.name} for ${cell.label}`}
        onCheckedChange={() => onToggleCell(row, cell)}
      />
      {loading ? <LoadingSpinner size="sm" label={`Updating ${cell.label}`} /> : null}
    </div>
  );
}
