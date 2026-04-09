import type { SkillListRow } from "../../model/types";
import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import { SkillCardFrame } from "./SkillCardFrame";
import { SkillCardHeader } from "./SkillCardHeader";
import { UnmanagedSkillCardBody } from "./UnmanagedSkillCardBody";

interface UnmanagedSkillCardProps {
  row: SkillListRow;
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

  return (
    <SkillCardFrame
      variant="unmanaged"
      selected={selected}
      onOpenSkill={() => onOpenSkill(row.skillRef)}
      content={(
        <>
          <SkillCardHeader
            name={row.name}
            skillRef={row.skillRef}
            onOpenSkill={onOpenSkill}
          />
          <UnmanagedSkillCardBody description={row.description || "No description provided."} />
        </>
      )}
      aside={(
        <div className="skill-card__action skill-card__action--compact">
          <button
            type="button"
            className="btn btn-secondary skill-card__manage-button"
            disabled={busyId !== null || !row.canManage}
            onClick={(event) => {
              event.stopPropagation();
              void onManageSkill(row.skillRef);
            }}
          >
            {managing ? <LoadingSpinner size="sm" label={`Managing ${row.name}`} /> : null}
            Manage
          </button>
        </div>
      )}
    />
  );
}
