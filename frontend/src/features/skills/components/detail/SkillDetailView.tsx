import { ErrorBanner } from "../../../../components/ErrorBanner";
import type { HarnessCellState } from "../../model/types";
import { useSkillDetailController } from "../../model/use-skill-detail-controller";
import { SkillDeleteDialog } from "../dialogs/SkillDeleteDialog";
import { SkillStopManagingDialog } from "../dialogs/SkillStopManagingDialog";
import { SkillDetailContent } from "./SkillDetailContent";
import { SkillDetailHeader } from "./SkillDetailHeader";
import { SkillDetailSkeleton } from "./SkillDetailSkeleton";

interface SkillDetailViewProps {
  skillRef: string;
  onClose: () => void;
  onManageSkill: (skillRef: string) => Promise<void>;
  onToggleSkill: (skillRef: string, harness: string, currentState: HarnessCellState) => Promise<void>;
  onUpdateSkill: (skillRef: string) => Promise<void>;
  onUnmanageSkill: (skillRef: string) => Promise<void>;
  onDeleteSkill: (skillRef: string) => Promise<void>;
}

export function SkillDetailView({
  skillRef,
  onClose,
  onManageSkill,
  onToggleSkill,
  onUpdateSkill,
  onUnmanageSkill,
  onDeleteSkill,
}: SkillDetailViewProps) {
  const {
    detail,
    isInitialLoading,
    isRefreshing,
    queryErrorMessage,
    actionErrorMessage,
    busyAction,
    isStopManagingDialogOpen,
    isDeleteDialogOpen,
    dismissActionError,
    onManage,
    onToggleHarness,
    onUpdate,
    requestStopManaging,
    requestDelete,
    setStopManagingDialogOpen,
    setDeleteDialogOpen,
    handleConfirmDelete,
    handleConfirmStopManaging,
  } = useSkillDetailController(skillRef, {
    onManageSkill,
    onToggleSkill,
    onUpdateSkill,
    onUnmanageSkill,
    onDeleteSkill,
  });

  if (isInitialLoading) {
    return <SkillDetailSkeleton onClose={onClose} />;
  }

  if (!detail && queryErrorMessage) {
    return (
      <>
        <div className="skill-detail__chrome">
          <SkillDetailHeader title={<h2>Unable to load skill</h2>} onClose={onClose} />
          <ErrorBanner message={queryErrorMessage} />
        </div>
        <div className="skill-detail__body">
          <div className="skill-detail__fallback">
            <p className="muted-text">Try selecting the skill again, or return to the list and reopen it.</p>
          </div>
        </div>
      </>
    );
  }

  if (!detail) {
    return <SkillDetailSkeleton onClose={onClose} />;
  }

  return (
    <>
      <SkillDetailContent
        detail={detail}
        isRefreshing={isRefreshing}
        actionErrorMessage={actionErrorMessage}
        queryErrorMessage={queryErrorMessage}
        busyAction={busyAction}
        onClose={onClose}
        onDismissActionError={dismissActionError}
        onManage={onManage}
        onToggleHarness={(cell) => onToggleHarness(cell.harness, cell.state)}
        onUpdate={onUpdate}
        onRequestStopManaging={requestStopManaging}
        onRequestDelete={requestDelete}
      />
      {detail.actions.stopManagingStatus !== null ? (
        <SkillStopManagingDialog
          open={isStopManagingDialogOpen}
          skillName={detail.name}
          harnessLabels={detail.actions.stopManagingHarnessLabels}
          isPending={busyAction === "unmanage"}
          onOpenChange={setStopManagingDialogOpen}
          onConfirm={handleConfirmStopManaging}
        />
      ) : null}
      {detail.actions.canDelete ? (
        <SkillDeleteDialog
          open={isDeleteDialogOpen}
          skillName={detail.name}
          harnessLabels={detail.actions.deleteHarnessLabels}
          isDeleting={busyAction === "delete"}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </>
  );
}
