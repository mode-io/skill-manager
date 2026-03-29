import type { SkillTableRow } from "../../api/types";
import { LoadingSpinner } from "../LoadingSpinner";

interface UnmanagedSkillCardProps {
  row: SkillTableRow;
  busyId: string | null;
  selected: boolean;
  onOpenSkill: (skillRef: string) => void;
  onManageSkill: (skillRef: string) => Promise<void>;
}

export function UnmanagedSkillCard({
  row,
  busyId,
  selected,
  onOpenSkill,
  onManageSkill,
}: UnmanagedSkillCardProps) {
  const managing = busyId === `manage:${row.skillRef}`;
  const locationsLabel = row.cells
    .filter((cell) => cell.state === "found")
    .map((cell) => cell.label)
    .join(", ") || "Unknown";

  return (
    <article
      className={`unmanaged-skill-card${selected ? " is-selected" : ""}`}
      onClick={() => onOpenSkill(row.skillRef)}
    >
      <div className="unmanaged-skill-card__header">
        <div className="unmanaged-skill-card__identity">
          <button
            type="button"
            className="unmanaged-skill-card__name"
            onClick={(event) => {
              event.stopPropagation();
              onOpenSkill(row.skillRef);
            }}
            aria-label={`Open details for ${row.name}`}
          >
            {row.name}
          </button>
        </div>

        <div className="unmanaged-skill-card__actions">
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
      </div>

      <div className="unmanaged-skill-card__body">
        <p className="unmanaged-skill-card__description">{row.description || "No description provided."}</p>
        <p className="unmanaged-skill-card__locations">
          <span className="unmanaged-skill-card__locations-label">Found in</span>
          <span>{locationsLabel}</span>
        </p>
      </div>
    </article>
  );
}
