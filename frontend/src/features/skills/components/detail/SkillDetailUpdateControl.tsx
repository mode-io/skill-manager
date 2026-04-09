import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import type { SkillUpdateStatus } from "../../model/types";

interface SkillDetailUpdateControlProps {
  updateStatus: SkillUpdateStatus;
  isBusy: boolean;
  disabled: boolean;
  onUpdate: () => void;
}

const UPDATE_STATUS_LABELS: Record<Exclude<SkillUpdateStatus, "update_available">, string> = {
  no_update_available: "No Update Available",
  no_source_available: "No Source Available",
};

export function SkillDetailUpdateControl({
  updateStatus,
  isBusy,
  disabled,
  onUpdate,
}: SkillDetailUpdateControlProps) {
  if (updateStatus === "update_available") {
    return (
      <button
        type="button"
        className="btn btn-secondary skill-detail__update-control"
        disabled={disabled}
        onClick={onUpdate}
      >
        {isBusy ? <LoadingSpinner size="sm" label="Updating skill" /> : null}
        Update From Source
      </button>
    );
  }

  return (
    <span className="btn btn-secondary btn-static skill-detail__update-control">
      {UPDATE_STATUS_LABELS[updateStatus]}
    </span>
  );
}
