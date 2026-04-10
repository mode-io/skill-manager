import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

import {
  cellActionKey,
  type BulkSkillsAction,
  type CellActionKey,
  type StructuralSkillAction,
} from "./pending";
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
  const [pendingToggleKeys, setPendingToggleKeys] = useState<Set<CellActionKey>>(() => new Set());
  const [pendingStructuralActions, setPendingStructuralActions] = useState<Map<string, StructuralSkillAction>>(
    () => new Map(),
  );
  const [pendingBulkAction, setPendingBulkAction] = useState<BulkSkillsAction | null>(null);

  const data = listQuery.data ?? null;
  const hasData = data !== null;
  const isInitialLoading = listQuery.isPending && !hasData;
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

  function addPendingToggle(key: CellActionKey): void {
    setPendingToggleKeys((current) => {
      if (current.has(key)) {
        return current;
      }
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }

  function removePendingToggle(key: CellActionKey): void {
    setPendingToggleKeys((current) => {
      if (!current.has(key)) {
        return current;
      }
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  function setPendingStructuralAction(skillRef: string, action: StructuralSkillAction): void {
    setPendingStructuralActions((current) => {
      if (current.get(skillRef) === action) {
        return current;
      }
      const next = new Map(current);
      next.set(skillRef, action);
      return next;
    });
  }

  function clearPendingStructuralAction(skillRef: string): void {
    setPendingStructuralActions((current) => {
      if (!current.has(skillRef)) {
        return current;
      }
      const next = new Map(current);
      next.delete(skillRef);
      return next;
    });
  }

  async function runToggleSkill(
    skillRef: string,
    harness: string,
    currentState: HarnessCellState,
    reportError: boolean,
  ): Promise<void> {
    const nextState: HarnessCellState = currentState === "enabled" ? "disabled" : "enabled";
    const key = cellActionKey(skillRef, harness);
    addPendingToggle(key);
    if (reportError) {
      setActionErrorMessage("");
    }
    try {
      await toggleMutation.mutateAsync({ skillRef, harness, nextState });
    } catch (error) {
      if (reportError) {
        setActionErrorMessage(error instanceof Error ? error.message : "Unable to toggle the skill.");
      }
      throw error;
    } finally {
      removePendingToggle(key);
    }
  }

  async function runStructuralAction(
    skillRef: string,
    action: StructuralSkillAction,
    task: () => Promise<unknown>,
    reportError: boolean,
    onSuccess?: () => void,
  ): Promise<void> {
    setPendingStructuralAction(skillRef, action);
    if (reportError) {
      setActionErrorMessage("");
    }
    try {
      await task();
      onSuccess?.();
    } catch (error) {
      if (reportError) {
        setActionErrorMessage(
          error instanceof Error ? error.message : "Unable to complete the requested action.",
        );
      }
      throw error;
    } finally {
      clearPendingStructuralAction(skillRef);
    }
  }

  async function handleToggleSkill(
    skillRef: string,
    harness: string,
    currentState: HarnessCellState,
  ): Promise<void> {
    await runToggleSkill(skillRef, harness, currentState, false);
  }

  async function handleManageSkill(skillRef: string): Promise<void> {
    await runStructuralAction(
      skillRef,
      "manage",
      () => manageMutation.mutateAsync({ skillRef }),
      false,
    );
  }

  async function handleManageSkillFromList(skillRef: string): Promise<void> {
    await runStructuralAction(
      skillRef,
      "manage",
      () => manageMutation.mutateAsync({ skillRef }),
      true,
    );
  }

  async function handleToggleSkillFromList(
    skillRef: string,
    harness: string,
    currentState: HarnessCellState,
  ): Promise<void> {
    await runToggleSkill(skillRef, harness, currentState, true);
  }

  async function handleManageAll(): Promise<void> {
    setPendingBulkAction("manage-all");
    setActionErrorMessage("");
    try {
      await manageAllMutation.mutateAsync();
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : "Unable to manage all skills.");
      throw error;
    } finally {
      setPendingBulkAction(null);
    }
  }

  async function handleUpdateSkill(skillRef: string): Promise<void> {
    await runStructuralAction(skillRef, "update", () => updateMutation.mutateAsync({ skillRef }), false);
  }

  async function handleDeleteSkill(skillRef: string): Promise<void> {
    await runStructuralAction(
      skillRef,
      "delete",
      () => deleteMutation.mutateAsync({ skillRef }),
      false,
      () => updateSelectedSkillRef(null, true),
    );
  }

  async function handleUnmanageSkill(skillRef: string): Promise<void> {
    await runStructuralAction(
      skillRef,
      "unmanage",
      () => unmanageMutation.mutateAsync({ skillRef }),
      false,
      () => updateSelectedSkillRef(null, true),
    );
  }

  function handleToggleCell(row: SkillListRow, cell: HarnessCell): void {
    void handleToggleSkillFromList(row.skillRef, cell.harness, cell.state);
  }

  const context: SkillsWorkspaceContextValue = {
    data,
    hasData,
    isInitialLoading,
    status,
    errorMessage: actionErrorMessage || (hasData ? queryErrorMessage : ""),
    pendingToggleKeys,
    pendingStructuralActions,
    pendingBulkAction,
    selectedSkillRef,
    onManageAll: () => void handleManageAll(),
    onManageSkill: handleManageSkillFromList,
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
