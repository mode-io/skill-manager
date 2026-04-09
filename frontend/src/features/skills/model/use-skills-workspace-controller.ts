import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

import type { HarnessCell, HarnessCellState, SkillListRow } from "./types";
import type { SkillsWorkspaceContextValue } from "./workspace-context";
import {
  useDeleteSkillMutation,
  useManageAllSkillsMutation,
  useManageSkillMutation,
  useSkillsListQuery,
  useToggleSkillMutation,
  useUnmanageSkillMutation,
  useUpdateSkillMutation,
} from "../api/queries";
import type { SkillsPaneDirection, SkillsPaneView } from "../components/pane/SkillsPaneTransition";

export interface SkillsWorkspaceController {
  context: SkillsWorkspaceContextValue;
  activeTab: SkillsPaneView;
  selectedSkillRef: string | null;
  isMobileDetail: boolean;
  isDesktopDetailOpen: boolean;
  shouldAnimatePaneTransition: boolean;
  transitionDirection: SkillsPaneDirection;
  actionErrorMessage: string;
  queryErrorMessage: string;
  isRefreshing: boolean;
  closeSelectedSkill: () => void;
  handleManageSkill: (skillRef: string) => Promise<void>;
  handleToggleSkill: (skillRef: string, harness: string, currentState: HarnessCellState) => Promise<void>;
  handleUpdateSkill: (skillRef: string) => Promise<void>;
  handleUnmanageSkill: (skillRef: string) => Promise<void>;
  handleDeleteSkill: (skillRef: string) => Promise<void>;
  dismissActionError: () => void;
}

export function useSkillsWorkspaceController(): SkillsWorkspaceController {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const listQuery = useSkillsListQuery();
  const toggleMutation = useToggleSkillMutation();
  const manageMutation = useManageSkillMutation();
  const manageAllMutation = useManageAllSkillsMutation();
  const updateMutation = useUpdateSkillMutation();
  const unmanageMutation = useUnmanageSkillMutation();
  const deleteMutation = useDeleteSkillMutation();
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

  async function handleDeleteSkill(skillRef: string): Promise<void> {
    setBusyId(`delete:${skillRef}`);
    setActionErrorMessage("");
    try {
      await deleteMutation.mutateAsync({ skillRef });
      updateSelectedSkillRef(null, true);
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : "Unable to delete the skill.");
      throw error;
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnmanageSkill(skillRef: string): Promise<void> {
    setBusyId(`unmanage:${skillRef}`);
    setActionErrorMessage("");
    try {
      await unmanageMutation.mutateAsync({ skillRef });
      updateSelectedSkillRef(null, true);
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : "Unable to stop managing the skill.");
      throw error;
    } finally {
      setBusyId(null);
    }
  }

  function handleToggleCell(row: SkillListRow, cell: HarnessCell): void {
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

  return {
    context,
    activeTab,
    selectedSkillRef,
    isMobileDetail,
    isDesktopDetailOpen: Boolean(selectedSkillRef) && !isMobileDetail,
    shouldAnimatePaneTransition,
    transitionDirection,
    actionErrorMessage,
    queryErrorMessage,
    isRefreshing,
    closeSelectedSkill: () => updateSelectedSkillRef(null),
    handleManageSkill,
    handleToggleSkill,
    handleUpdateSkill,
    handleUnmanageSkill,
    handleDeleteSkill,
    dismissActionError: () => setActionErrorMessage(""),
  };
}

type SkillsWorkspaceTab = SkillsPaneView;

function rowVisibleOnTab(row: SkillListRow, tab: SkillsWorkspaceTab): boolean {
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
