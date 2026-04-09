import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import type { SkillActions } from "../../model/types";
import { SkillDetailStopManagingAction } from "./SkillDetailStopManagingAction";
import { SkillDetailUpdateControl } from "./SkillDetailUpdateControl";

interface SkillDetailActionBarProps {
  actions: SkillActions;
  busyAction: string | null;
  onUpdate: () => void;
  onRequestStopManaging: () => void;
  onRequestDelete: () => void;
}

export function SkillDetailActionBar({
  actions,
  busyAction,
  onUpdate,
  onRequestStopManaging,
  onRequestDelete,
}: SkillDetailActionBarProps) {
  const showActionRow =
    actions.updateStatus !== null || actions.stopManagingStatus !== null || actions.canDelete;

  if (!showActionRow) {
    return null;
  }

  return (
    <div className="skill-detail__primary-actions">
      <div className="skill-detail__action-row">
        <div className="skill-detail__actions">
          {actions.updateStatus ? (
            <SkillDetailUpdateControl
              updateStatus={actions.updateStatus}
              isBusy={busyAction === "update"}
              disabled={busyAction !== null}
              onUpdate={onUpdate}
            />
          ) : null}
        </div>
        {actions.stopManagingStatus !== null || actions.canDelete ? (
          <div className="skill-detail__action-trailing">
            {actions.stopManagingStatus !== null ? (
              <SkillDetailStopManagingAction
                status={actions.stopManagingStatus}
                disabled={busyAction !== null}
                onRequestStopManaging={onRequestStopManaging}
              />
            ) : null}
            {actions.canDelete ? (
              <button
                type="button"
                className="btn btn-danger"
                disabled={busyAction !== null}
                onClick={onRequestDelete}
              >
                {busyAction === "delete" ? <LoadingSpinner size="sm" label="Deleting skill" /> : null}
                Delete Skill
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
