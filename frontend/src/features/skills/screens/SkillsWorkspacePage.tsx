import { Outlet } from "react-router-dom";

import { BulkActionBar } from "../../../components/BulkActionBar";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { SkillDetailModal } from "../components/detail/SkillDetailModal";
import { useSkillsCopy } from "../i18n";
import { pendingToggleHarnessesForSkill } from "../model/pending";
import { useSkillsWorkspaceController } from "../model/use-skills-workspace-controller";

export default function SkillsWorkspacePage() {
  const {
    context,
    activeTab,
    selectedSkillRef,
    isDesktopDetailOpen,
    actionErrorMessage,
    queryErrorMessage,
    closeSelectedSkill,
    handleManageSkill,
    handleToggleSkill,
    handleUpdateSkill,
    handleRemoveSkill,
    handleDeleteSkill,
    dismissActionError,
  } = useSkillsWorkspaceController();
  const copy = useSkillsCopy();

  const hasData = context.hasData;
  const selectedPendingToggleHarnesses = selectedSkillRef
    ? pendingToggleHarnessesForSkill(context.pendingToggleKeys, selectedSkillRef)
    : EMPTY_PENDING_TOGGLE_HARNESSES;
  const selectedPendingStructuralAction = selectedSkillRef
    ? context.pendingStructuralActions.get(selectedSkillRef) ?? null
    : null;

  return (
    <>
      {actionErrorMessage ? (
        <ErrorBanner message={actionErrorMessage} onDismiss={dismissActionError} />
      ) : null}
      {!actionErrorMessage && hasData && queryErrorMessage ? (
        <ErrorBanner message={queryErrorMessage} />
      ) : null}
      <Outlet context={context} />

      {activeTab === "inUse" ? (
        <BulkActionBar
          selectedCount={context.multiSelectedRefs.size}
          pending={context.multiSelectPending}
          onClear={context.onClearMultiSelect}
          onEnableAll={context.onMultiSelectEnableAll}
          onDisableAll={context.onMultiSelectDisableAll}
          onDelete={context.onMultiSelectDelete}
          destructive={{
            actionLabel: copy.bulk.delete,
            confirmTitle: copy.bulk.confirmTitle(context.multiSelectedRefs.size),
            confirmDescription: copy.bulk.confirmDescription,
            confirmNote: copy.bulk.confirmNote,
          }}
        />
      ) : null}

      <SkillDetailModal
        open={isDesktopDetailOpen || Boolean(selectedSkillRef)}
        skillRef={selectedSkillRef}
        pendingToggleHarnesses={selectedPendingToggleHarnesses}
        pendingStructuralAction={selectedPendingStructuralAction}
        onClose={closeSelectedSkill}
        onManageSkill={handleManageSkill}
        onToggleSkill={handleToggleSkill}
        onUpdateSkill={handleUpdateSkill}
        onRemoveSkill={handleRemoveSkill}
        onDeleteSkill={handleDeleteSkill}
      />
    </>
  );
}

const EMPTY_PENDING_TOGGLE_HARNESSES = new Set<string>();
