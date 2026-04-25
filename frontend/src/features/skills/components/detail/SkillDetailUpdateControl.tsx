import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import type { SkillUpdateStatus } from "../../model/types";

interface SkillDetailUpdateControlProps {
  updateStatus: SkillUpdateStatus;
  pending: boolean;
  disabled: boolean;
  onUpdate: () => void;
}

const UPDATE_STATUS_LABELS: Record<Exclude<SkillUpdateStatus, "update_available" | "local_changes_detected">, string> = {
  no_update_available: "No Update Available",
  no_source_available: "No Source Available",
};

export function SkillDetailUpdateControl({
  updateStatus,
  pending,
  disabled,
  onUpdate,
}: SkillDetailUpdateControlProps) {
  if (updateStatus === "update_available") {
    return (
      <button
        type="button"
        className="action-pill action-pill--md skill-detail__update-control"
        disabled={disabled}
        onClick={onUpdate}
      >
        {pending ? <LoadingSpinner size="sm" label="Updating skill" /> : null}
        Update From Source
      </button>
    );
  }

  if (updateStatus === "local_changes_detected") {
    return null;
  }

  return (
    <span className="card-status-pill card-status-pill--md skill-detail__update-control">
      {UPDATE_STATUS_LABELS[updateStatus]}
    </span>
  );
}
