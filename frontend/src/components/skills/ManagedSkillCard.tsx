import type { HarnessCell, HarnessColumn, SkillTableRow } from "../../api/types";
import { LoadingSpinner } from "../LoadingSpinner";
import { ManagedSkillCardBody } from "./ManagedSkillCardBody";
import { ManagedSkillCardHeader } from "./ManagedSkillCardHeader";
import { ManagedSkillHarnessCluster } from "./ManagedSkillHarnessCluster";

interface ManagedSkillCardProps {
  row: SkillTableRow;
  columns: HarnessColumn[];
  busyId: string | null;
  selected: boolean;
  onOpenSkill: (skillRef: string) => void;
  onManageSkill: (skillRef: string) => Promise<void>;
  onToggleCell: (row: SkillTableRow, cell: HarnessCell) => void;
}

export function ManagedSkillCard({
  row,
  columns,
  busyId,
  selected,
  onOpenSkill,
  onManageSkill,
  onToggleCell,
}: ManagedSkillCardProps) {
  const managing = busyId === `manage:${row.skillRef}`;

  return (
    <article
      className={`skill-card${selected ? " is-selected" : ""}`}
      onClick={() => onOpenSkill(row.skillRef)}
    >
      <div className="skill-card__content">
        <ManagedSkillCardHeader row={row} onOpenSkill={onOpenSkill} />
        <ManagedSkillCardBody row={row} />
      </div>

      <div className="skill-card__aside">
        <ManagedSkillHarnessCluster
          row={row}
          columns={columns}
          busyId={busyId}
          onToggleCell={onToggleCell}
        />

        {row.primaryAction.kind === "manage" ? (
          <div className="skill-card__action">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busyId !== null}
              onClick={(event) => {
                event.stopPropagation();
                void onManageSkill(row.skillRef);
              }}
            >
              {managing ? <LoadingSpinner size="sm" label={`Managing ${row.name}`} /> : null}
              {row.primaryAction.label}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
