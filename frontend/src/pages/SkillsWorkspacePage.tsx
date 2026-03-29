import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router-dom";

import type { HarnessCell, HarnessCellState, SkillTableRow } from "../api/types";
import { ErrorBanner } from "../components/ErrorBanner";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { SkillDetailPanel } from "../components/SkillDetailPanel";
import { SkillDetailDrawer } from "../components/SkillDetailDrawer";
import { SkillsPaneTransition, type SkillsPaneDirection, type SkillsPaneView } from "../components/skills/SkillsPaneTransition";
import { SkillsWorkspaceTabs } from "../components/skills/SkillsWorkspaceTabs";
import type { SkillsWorkspaceContextValue } from "../components/skills/workspace";
import {
  useManageAllSkillsMutation,
  useManageSkillMutation,
  useSkillsListQuery,
  useToggleSkillMutation,
  useUpdateSkillMutation,
} from "../features/skills/queries";

export function SkillsWorkspacePage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const listQuery = useSkillsListQuery();
  const toggleMutation = useToggleSkillMutation();
  const manageMutation = useManageSkillMutation();
  const manageAllMutation = useManageAllSkillsMutation();
  const updateMutation = useUpdateSkillMutation();
  const isMobileDetail = useCompactDetailLayout();

  const [actionErrorMessage, setActionErrorMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const data = listQuery.data ?? null;
  const hasData = data !== null;
  const isInitialLoading = listQuery.isPending && !hasData;
  const isRefreshing = listQuery.isFetching && hasData;
  const queryErrorMessage = listQuery.error instanceof Error ? listQuery.error.message : "";
  const status: "loading" | "ready" | "error" = isInitialLoading
    ? "loading"
    : hasData
      ? "ready"
      : queryErrorMessage
        ? "error"
        : "loading";
  const activeTab = location.pathname.endsWith("/unmanaged") ? "unmanaged" : "managed";
  const selectedSkillRef = searchParams.get("skill");
  const { direction: transitionDirection, shouldAnimate: shouldAnimatePaneTransition } = usePaneTransition(activeTab);

  const updateSelectedSkillRef = useCallback((skillRef: string | null, replace = false) => {
    const nextParams = new URLSearchParams(searchParams);
    if (skillRef) {
      nextParams.set("skill", skillRef);
    } else {
      nextParams.delete("skill");
    }
    setSearchParams(nextParams, { replace });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!selectedSkillRef || !data) {
      return;
    }
    const stillVisibleInTab = data.rows.some((row) =>
      row.skillRef === selectedSkillRef && rowVisibleOnTab(row, activeTab),
    );
    if (!stillVisibleInTab) {
      updateSelectedSkillRef(null, true);
    }
  }, [activeTab, data, selectedSkillRef, updateSelectedSkillRef]);

  const handleOpenSkill = useCallback((skillRef: string) => {
    updateSelectedSkillRef(selectedSkillRef === skillRef ? null : skillRef);
  }, [selectedSkillRef, updateSelectedSkillRef]);

  async function handleToggleSkill(
    skillRef: string,
    harness: string,
    currentState: HarnessCellState,
  ): Promise<void> {
    const nextState: HarnessCellState = currentState === "enabled" ? "disabled" : "enabled";
    setBusyId(`${skillRef}:${harness}`);
    setActionErrorMessage("");
    try {
      await toggleMutation.mutateAsync({ skillRef, harness, nextState });
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : "Unable to toggle the skill.");
      throw error;
    } finally {
      setBusyId(null);
    }
  }

  async function handleManageSkill(skillRef: string): Promise<void> {
    setBusyId(`manage:${skillRef}`);
    setActionErrorMessage("");
    try {
      await manageMutation.mutateAsync({ skillRef });
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : "Unable to manage the skill.");
      throw error;
    } finally {
      setBusyId(null);
    }
  }

  async function handleManageAll(): Promise<void> {
    setBusyId("manage-all");
    setActionErrorMessage("");
    try {
      await manageAllMutation.mutateAsync();
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : "Unable to manage all skills.");
      throw error;
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpdateSkill(skillRef: string): Promise<void> {
    setBusyId(`update:${skillRef}`);
    setActionErrorMessage("");
    try {
      await updateMutation.mutateAsync({ skillRef });
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : "Unable to update the skill.");
      throw error;
    } finally {
      setBusyId(null);
    }
  }

  function handleToggleCell(row: SkillTableRow, cell: HarnessCell): void {
    void handleToggleSkill(row.skillRef, cell.harness, cell.state);
  }

  const context: SkillsWorkspaceContextValue = {
    data,
    hasData,
    isInitialLoading,
    isRefreshing,
    status,
    errorMessage: actionErrorMessage || (hasData ? queryErrorMessage : ""),
    busyId,
    selectedSkillRef,
    onManageAll: () => void handleManageAll(),
    onManageSkill: handleManageSkill,
    onOpenSkill: handleOpenSkill,
    onToggleCell: handleToggleCell,
  };

  const isDesktopDetailOpen = Boolean(selectedSkillRef) && !isMobileDetail;

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
                  {isRefreshing ? (
                    <div className="skills-workspace__refresh" aria-live="polite">
                      <LoadingSpinner size="sm" label="Refreshing skills" />
                    </div>
                  ) : null}
                </div>

                {actionErrorMessage ? (
                  <ErrorBanner message={actionErrorMessage} onDismiss={() => setActionErrorMessage("")} />
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
              onClose={() => updateSelectedSkillRef(null)}
              onManageSkill={handleManageSkill}
              onUpdateSkill={handleUpdateSkill}
            />
          ) : null}
        </div>
      </section>

      {isMobileDetail ? (
        <SkillDetailDrawer
          skillRef={selectedSkillRef}
          onClose={() => updateSelectedSkillRef(null)}
          onManageSkill={handleManageSkill}
          onUpdateSkill={handleUpdateSkill}
        />
      ) : null}
    </>
  );
}

type SkillsWorkspaceTab = SkillsPaneView;

function rowVisibleOnTab(row: SkillTableRow, tab: SkillsWorkspaceTab): boolean {
  if (tab === "unmanaged") {
    return row.displayStatus === "Unmanaged";
  }
  return row.displayStatus === "Managed" || row.displayStatus === "Custom" || row.displayStatus === "Built-in";
}

function usePaneTransition(activeTab: SkillsPaneView): { direction: SkillsPaneDirection; shouldAnimate: boolean } {
  const previousTabRef = useRef<SkillsPaneView | null>(null);
  const [transitionState, setTransitionState] = useState<{
    direction: SkillsPaneDirection;
    shouldAnimate: boolean;
  }>({
    direction: "forward",
    shouldAnimate: false,
  });

  useEffect(() => {
    const previousTab = previousTabRef.current;
    if (previousTab === null) {
      previousTabRef.current = activeTab;
      return;
    }

    if (previousTab !== activeTab) {
      setTransitionState({
        direction: getPaneDirection(previousTab, activeTab),
        shouldAnimate: true,
      });
      previousTabRef.current = activeTab;
    }
  }, [activeTab]);

  return transitionState;
}

function getPaneDirection(previousTab: SkillsPaneView, activeTab: SkillsPaneView): SkillsPaneDirection {
  return previousTab === "managed" && activeTab === "unmanaged" ? "forward" : "backward";
}

function useCompactDetailLayout(breakpointPx = 1180): boolean {
  const [matches, setMatches] = useState(() => getCompactDetailLayoutMatch(breakpointPx));

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      setMatches(getCompactDetailLayoutMatch(breakpointPx));
      return undefined;
    }

    const mediaQuery = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const update = () => setMatches(mediaQuery.matches);
    update();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, [breakpointPx]);

  return matches;
}

function getCompactDetailLayoutMatch(breakpointPx: number): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (typeof window.matchMedia === "function") {
    return window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
  }
  return window.innerWidth <= breakpointPx;
}
