import { useId } from "react";

import { DetailHeader } from "../../../../components/detail/DetailHeader";
import { ErrorBanner } from "../../../../components/ErrorBanner";
import type { StructuralSkillAction } from "../../model/pending";
import type { HarnessCellState } from "../../model/types";
import { useSkillDetailController } from "../../model/use-skill-detail-controller";
import { SkillActionConfirmDialog } from "../dialogs/SkillActionConfirmDialog";
import { SkillDetailContent } from "./SkillDetailContent";
import { SkillDetailSkeleton } from "./SkillDetailSkeleton";
import { SkillDetailShell } from "./SkillDetailShell";

interface SkillDetailViewProps {
  skillRef: string;
  pendingToggleHarnesses: ReadonlySet<string>;
  pendingStructuralAction: StructuralSkillAction | null;
  onClose: () => void;
  onManageSkill: (skillRef: string) => Promise<void>;
  onToggleSkill: (skillRef: string, harness: string, currentState: HarnessCellState) => Promise<void>;
  onUpdateSkill: (skillRef: string) => Promise<void>;
  onRemoveSkill: (skillRef: string) => Promise<void>;
  onDeleteSkill: (skillRef: string) => Promise<void>;
}

export function SkillDetailView({
  skillRef,
  pendingToggleHarnesses,
  pendingStructuralAction,
  onClose,
  onManageSkill,
  onToggleSkill,
  onUpdateSkill,
  onRemoveSkill,
  onDeleteSkill,
}: SkillDetailViewProps) {
  const fallbackHeadingId = useId();
  const {
      detail,
      isInitialLoading,
      queryErrorMessage,
      actionErrorMessage,
      isRemoveDialogOpen,
      isDeleteDialogOpen,
      dismissActionError,
    onManage,
    onToggleHarness,
    onUpdate,
    requestRemove,
    requestDelete,
    setRemoveDialogOpen,
    setDeleteDialogOpen,
    handleConfirmDelete,
    handleConfirmRemove,
  } = useSkillDetailController(skillRef, {
    onManageSkill,
    onToggleSkill,
    onUpdateSkill,
    onRemoveSkill,
    onDeleteSkill,
  });

  if (isInitialLoading) {
    return <SkillDetailSkeleton onClose={onClose} />;
  }

  if (!detail && queryErrorMessage) {
    return (
      <SkillDetailShell
        chrome={(
          <div className="skill-detail__chrome">
            <DetailHeader
              title={<h2 id={fallbackHeadingId}>Unable to load skill</h2>}
              closeLabel="Close skill details"
              onClose={onClose}
            />
            <ErrorBanner message={queryErrorMessage} />
          </div>
        )}
        body={(
          <div className="skill-detail__fallback">
            <p className="muted-text">Try selecting the skill again, or return to the list and reopen it.</p>
          </div>
        )}
        bodyAriaLabelledBy={fallbackHeadingId}
      />
    );
  }

  if (!detail) {
    return <SkillDetailSkeleton onClose={onClose} />;
  }

  return (
    <>
      <SkillDetailContent
        detail={detail}
        actionErrorMessage={actionErrorMessage}
        queryErrorMessage={queryErrorMessage}
        pendingToggleHarnesses={pendingToggleHarnesses}
        pendingStructuralAction={pendingStructuralAction}
        onClose={onClose}
        onDismissActionError={dismissActionError}
        onManage={onManage}
        onToggleHarness={(cell) => onToggleHarness(cell.harness, cell.state)}
        onUpdate={onUpdate}
        onRequestRemove={requestRemove}
        onRequestDelete={requestDelete}
      />
      {detail.actions.stopManagingStatus !== null ? (
        <SkillActionConfirmDialog
          open={isRemoveDialogOpen}
          action="unmanage"
          skillName={detail.name}
          harnessLabels={detail.actions.stopManagingHarnessLabels}
          isPending={pendingStructuralAction === "unmanage"}
          onOpenChange={setRemoveDialogOpen}
          onConfirm={handleConfirmRemove}
        />
      ) : null}
      {detail.actions.canDelete ? (
        <SkillActionConfirmDialog
          open={isDeleteDialogOpen}
          action="delete"
          skillName={detail.name}
          harnessLabels={detail.actions.deleteHarnessLabels}
          isPending={pendingStructuralAction === "delete"}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </>
  );
}
