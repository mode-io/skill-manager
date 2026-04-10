import { Outlet } from "react-router-dom";

import { ErrorBanner } from "../../../components/ErrorBanner";
import { SkillDetailDrawer } from "../components/detail/SkillDetailDrawer";
import { SkillDetailPanel } from "../components/detail/SkillDetailPanel";
import { SkillsPaneTransition } from "../components/pane/SkillsPaneTransition";
import { SkillsWorkspaceTabs } from "../components/pane/SkillsWorkspaceTabs";
import { pendingToggleHarnessesForSkill } from "../model/pending";
import { useSkillsWorkspaceController } from "../model/use-skills-workspace-controller";

export function SkillsWorkspacePage() {
  const {
    context,
    activeTab,
    selectedSkillRef,
    isMobileDetail,
    isDesktopDetailOpen,
    shouldAnimatePaneTransition,
    transitionDirection,
    actionErrorMessage,
    queryErrorMessage,
    closeSelectedSkill,
    handleManageSkill,
    handleToggleSkill,
    handleUpdateSkill,
    handleUnmanageSkill,
    handleDeleteSkill,
    dismissActionError,
  } = useSkillsWorkspaceController();

  const data = context.data;
  const hasData = context.hasData;
  const selectedPendingToggleHarnesses = selectedSkillRef
    ? pendingToggleHarnessesForSkill(context.pendingToggleKeys, selectedSkillRef)
    : EMPTY_PENDING_TOGGLE_HARNESSES;
  const selectedPendingStructuralAction = selectedSkillRef
    ? context.pendingStructuralActions.get(selectedSkillRef) ?? null
    : null;

  return (
    <>
      <section className="skills-workspace-page">
        <div className={`skills-workspace-shell${isDesktopDetailOpen ? " is-detail-open" : ""}`}>
          <div className="skills-workspace-shell__main">
            <section className="skills-workspace">
              <div className="skills-workspace__top">
                <div className="skills-workspace__header">
                  <div className="skills-workspace__header-main">
                    <div className="skills-workspace__title-row">
                      <h2>Skills</h2>
                      <SkillsWorkspaceTabs summary={data?.summary ?? null} />
                    </div>
                  </div>
                </div>

                {actionErrorMessage ? (
                  <ErrorBanner message={actionErrorMessage} onDismiss={dismissActionError} />
                ) : null}
                {!actionErrorMessage && hasData && queryErrorMessage ? (
                  <ErrorBanner message={queryErrorMessage} />
                ) : null}
              </div>

              <div className="skills-workspace__content">
                <SkillsPaneTransition
                  view={activeTab}
                  direction={transitionDirection}
                  animate={shouldAnimatePaneTransition}
                >
                  <Outlet context={context} />
                </SkillsPaneTransition>
              </div>
            </section>
          </div>
          {!isMobileDetail ? (
            <SkillDetailPanel
              isOpen={isDesktopDetailOpen}
              skillRef={selectedSkillRef}
              pendingToggleHarnesses={selectedPendingToggleHarnesses}
              pendingStructuralAction={selectedPendingStructuralAction}
              onClose={closeSelectedSkill}
              onManageSkill={handleManageSkill}
              onToggleSkill={handleToggleSkill}
              onUpdateSkill={handleUpdateSkill}
              onUnmanageSkill={handleUnmanageSkill}
              onDeleteSkill={handleDeleteSkill}
            />
          ) : null}
        </div>
      </section>

      {isMobileDetail ? (
        <SkillDetailDrawer
          skillRef={selectedSkillRef}
          pendingToggleHarnesses={selectedPendingToggleHarnesses}
          pendingStructuralAction={selectedPendingStructuralAction}
          onClose={closeSelectedSkill}
          onManageSkill={handleManageSkill}
          onToggleSkill={handleToggleSkill}
          onUpdateSkill={handleUpdateSkill}
          onUnmanageSkill={handleUnmanageSkill}
          onDeleteSkill={handleDeleteSkill}
        />
      ) : null}
    </>
  );
}

const EMPTY_PENDING_TOGGLE_HARNESSES = new Set<string>();
