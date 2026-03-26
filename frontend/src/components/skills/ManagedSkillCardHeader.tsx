import type { HarnessCell, HarnessColumn, SkillTableRow } from "../../api/types";
import { LoadingSpinner } from "../LoadingSpinner";
import { StatusBadge } from "../ui/StatusBadge";
import { skillStatusTone } from "../ui/statusMappings";
import { ManagedSkillHarnessCluster } from "./ManagedSkillHarnessCluster";
import { summarizeManagedSkillRow } from "./model";

interface ManagedSkillCardHeaderProps {
  row: SkillTableRow;
  columns: HarnessColumn[];
  busyId: string | null;
  onOpenSkill: (skillRef: string) => void;
  onToggleCell: (row: SkillTableRow, cell: HarnessCell) => void;
  onRunPrimaryAction: (row: SkillTableRow) => void;
}

export function ManagedSkillCardHeader({
  row,
  columns,
  busyId,
  onOpenSkill,
  onToggleCell,
  onRunPrimaryAction,
}: ManagedSkillCardHeaderProps): JSX.Element {
  const managing = busyId === `manage:${row.skillRef}`;
  const actionLabel = row.primaryAction.kind === "open" ? "Details" : row.primaryAction.label;
  const summary = summarizeManagedSkillRow(row);

  return (
    <div className="skill-card__header">
      <div className="skill-card__identity">
        <button
          type="button"
          className="skill-card__name"
          onClick={() => onOpenSkill(row.skillRef)}
          aria-label={`Open details for ${row.name}`}
        >
          {row.name}
        </button>
        <div className="skill-card__meta">
          {row.displayStatus !== "Managed" && (
            <StatusBadge label={row.displayStatus} tone={skillStatusTone(row.displayStatus)} />
          )}
          <span className="skill-card__coverage">{summary.coverageLabel}</span>
        </div>
        {row.attentionMessage ? <p className="skill-card__attention">{row.attentionMessage}</p> : null}
      </div>

      <ManagedSkillHarnessCluster
        row={row}
        columns={columns}
        busyId={busyId}
        onToggleCell={onToggleCell}
      />

      <div className="skill-card__action">
        <button
          type="button"
          className={`btn ${row.primaryAction.kind === "manage" ? "btn-primary" : "btn-secondary"}`}
          disabled={busyId !== null}
          onClick={() => onRunPrimaryAction(row)}
        >
          {managing ? <LoadingSpinner size="sm" label={`Managing ${row.name}`} /> : null}
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
