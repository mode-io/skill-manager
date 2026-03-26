import type { SkillTableRow } from "../../api/types";
import { LoadingSpinner } from "../LoadingSpinner";
import { summarizeFoundLocalSkill } from "./model";

interface FoundLocalSkillCardProps {
  row: SkillTableRow;
  busyId: string | null;
  onOpenSkill: (skillRef: string) => void;
  onRunPrimaryAction: (row: SkillTableRow) => void;
}

export function FoundLocalSkillCard({
  row,
  busyId,
  onOpenSkill,
  onRunPrimaryAction,
}: FoundLocalSkillCardProps): JSX.Element {
  const summary = summarizeFoundLocalSkill(row);
  const managing = busyId === `manage:${row.skillRef}`;

  return (
    <article className="found-skill-card">
      <div className="found-skill-card__header">
        <div className="found-skill-card__identity">
          <button
            type="button"
            className="found-skill-card__name"
            onClick={() => onOpenSkill(row.skillRef)}
            aria-label={`Open details for ${row.name}`}
          >
            {row.name}
          </button>
          <span className="found-skill-card__summary">{summary.coverageLabel}</span>
        </div>

        <div className="found-skill-card__actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busyId !== null}
            onClick={() => onRunPrimaryAction(row)}
          >
            {managing ? <LoadingSpinner size="sm" label={`Managing ${row.name}`} /> : null}
            {row.primaryAction.label}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busyId !== null}
            onClick={() => onOpenSkill(row.skillRef)}
          >
            Details
          </button>
        </div>
      </div>

      <div className="found-skill-card__body">
        <p className="found-skill-card__description">{row.description || "No description provided."}</p>
        <p className="found-skill-card__locations">
          <span className="found-skill-card__locations-label">Found in</span>
          <span>{summary.locationsLabel}</span>
        </p>
      </div>
    </article>
  );
}
