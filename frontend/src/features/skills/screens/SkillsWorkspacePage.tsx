import { Outlet } from "react-router-dom";

import { BulkActionBar } from "../../../components/BulkActionBar";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { SkillDetailModal } from "../components/detail/SkillDetailModal";
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
            actionLabel: "Delete",
            confirmTitle: `Delete ${context.multiSelectedRefs.size} skill${
              context.multiSelectedRefs.size === 1 ? "" : "s"
            }?`,
            confirmDescription:
              "This removes the Skill Manager copy and its symlinks from every harness.",
            confirmNote: "The source on disk outside the Skill Manager store is not touched.",
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
