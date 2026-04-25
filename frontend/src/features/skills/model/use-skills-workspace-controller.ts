import { useCallback, useEffect, useState } from "react";

import { usePendingRegistry } from "../../../lib/async/pending-registry";
import {
  cellActionKey,
  type BulkSkillsAction,
  type CellActionKey,
  type StructuralSkillAction,
} from "./pending";
import type { HarnessCell, HarnessCellState, SkillListRow } from "./types";
import type {
  MultiSelectAction,
  SetAllHarnessesFailure,
  SetAllHarnessesResult,
  SetAllHarnessesTarget,
  SkillsWorkspaceContextValue,
} from "./workspace-context";
import {
  useDeleteSkillMutation,
  useManageAllSkillsMutation,
  useManageSkillMutation,
  useSetSkillHarnessesMutation,
  useSkillsListQuery,
  useToggleSkillMutation,
  useUnmanageSkillMutation,
  useUpdateSkillMutation,
} from "../api/queries";
import { useSkillWorkspaceSelection, type SkillsWorkspaceTab } from "./use-skill-workspace-selection";

export interface SkillsWorkspaceController {
  context: SkillsWorkspaceContextValue;
  activeTab: SkillsWorkspaceTab;
  selectedSkillRef: string | null;
  isDesktopDetailOpen: boolean;
  actionErrorMessage: string;
  queryErrorMessage: string;
  closeSelectedSkill: () => void;
  handleManageSkill: (skillRef: string) => Promise<void>;
  handleToggleSkill: (skillRef: string, harness: string, currentState: HarnessCellState) => Promise<void>;
  handleUpdateSkill: (skillRef: string) => Promise<void>;
  handleRemoveSkill: (skillRef: string) => Promise<void>;
  handleDeleteSkill: (skillRef: string) => Promise<void>;
  dismissActionError: () => void;
}

export function useSkillsWorkspaceController(): SkillsWorkspaceController {
  const listQuery = useSkillsListQuery();
  const toggleMutation = useToggleSkillMutation();
  const setHarnessesMutation = useSetSkillHarnessesMutation();
  const manageMutation = useManageSkillMutation();
  const manageAllMutation = useManageAllSkillsMutation();
  const updateMutation = useUpdateSkillMutation();
  const removeMutation = useUnmanageSkillMutation();
  const deleteMutation = useDeleteSkillMutation();

  const [actionErrorMessage, setActionErrorMessage] = useState("");
  const toggleRegistry = usePendingRegistry<CellActionKey>();
  const [pendingStructuralActions, setPendingStructuralActions] = useState<Map<string, StructuralSkillAction>>(
    () => new Map(),
  );
  const [pendingBulkAction, setPendingBulkAction] = useState<BulkSkillsAction | null>(null);
  const [multiSelectedRefs, setMultiSelectedRefs] = useState<Set<string>>(() => new Set());
  const [multiSelectPending, setMultiSelectPending] = useState<MultiSelectAction | null>(null);

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
  const {
    activeTab,
    selectedSkillRef,
    isDesktopDetailOpen,
    closeSelectedSkill,
    handleOpenSkill,
    updateSelectedSkillRef,
  } = useSkillWorkspaceSelection(data);

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
    if (reportError) {
      setActionErrorMessage("");
    }
    try {
      await toggleRegistry.run(key, () =>
        toggleMutation.mutateAsync({ skillRef, harness, nextState }),
      );
    } catch (error) {
      if (reportError) {
        setActionErrorMessage(error instanceof Error ? error.message : "Unable to toggle the skill.");
      }
      throw error;
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

  async function handleDeleteSkillFromList(skillRef: string): Promise<void> {
    await runStructuralAction(
      skillRef,
      "delete",
      () => deleteMutation.mutateAsync({ skillRef }),
      true,
      () => updateSelectedSkillRef(null, true),
    );
  }

  async function handleRemoveSkill(skillRef: string): Promise<void> {
    await runStructuralAction(
      skillRef,
      "unmanage",
      () => removeMutation.mutateAsync({ skillRef }),
      false,
      () => updateSelectedSkillRef(null, true),
    );
  }

  async function handleRemoveSkillFromList(skillRef: string): Promise<void> {
    await runStructuralAction(
      skillRef,
      "unmanage",
      () => removeMutation.mutateAsync({ skillRef }),
      true,
      () => updateSelectedSkillRef(null, true),
    );
  }

  function handleToggleCell(row: SkillListRow, cell: HarnessCell): void {
    void handleToggleSkillFromList(row.skillRef, cell.harness, cell.state);
  }

  const toggleMultiSelect = useCallback((skillRef: string) => {
    setMultiSelectedRefs((current) => {
      const next = new Set(current);
      if (next.has(skillRef)) {
        next.delete(skillRef);
      } else {
        next.add(skillRef);
      }
      return next;
    });
  }, []);

  const clearMultiSelect = useCallback(() => {
    setMultiSelectedRefs((current) => (current.size === 0 ? current : new Set()));
  }, []);

  // Drop selection when a previously selected row leaves the dataset.
  useEffect(() => {
    if (!data || multiSelectedRefs.size === 0) {
      return;
    }
    const available = new Set(data.rows.map((row) => row.skillRef));
    let changed = false;
    const next = new Set<string>();
    for (const ref of multiSelectedRefs) {
      if (available.has(ref)) {
        next.add(ref);
      } else {
        changed = true;
      }
    }
    if (changed) {
      setMultiSelectedRefs(next);
    }
  }, [data, multiSelectedRefs]);

  async function runMultiSelect(
    action: MultiSelectAction,
    task: (rows: SkillListRow[]) => Promise<unknown>,
  ): Promise<void> {
    if (multiSelectedRefs.size === 0 || !data) {
      return;
    }
    const rows = data.rows.filter((row) => multiSelectedRefs.has(row.skillRef));
    if (rows.length === 0) {
      return;
    }
    setMultiSelectPending(action);
    setActionErrorMessage("");
    try {
      await task(rows);
      setMultiSelectedRefs(new Set());
    } catch (error) {
      setActionErrorMessage(error instanceof Error ? error.message : "Unable to complete the bulk action.");
      throw error;
    } finally {
      setMultiSelectPending(null);
    }
  }

  async function handleMultiSelectEnableAll(): Promise<void> {
    await runMultiSelect("enable-all", async (rows) => {
      const tasks: Promise<unknown>[] = [];
      for (const row of rows) {
        for (const cell of row.cells) {
          if (cell.state === "disabled") {
            tasks.push(toggleMutation.mutateAsync({ skillRef: row.skillRef, harness: cell.harness, nextState: "enabled" }));
          }
        }
      }
      await Promise.all(tasks);
    });
  }

  async function handleMultiSelectDisableAll(): Promise<void> {
    await runMultiSelect("disable-all", async (rows) => {
      const tasks: Promise<unknown>[] = [];
      for (const row of rows) {
        for (const cell of row.cells) {
          if (cell.state === "enabled") {
            tasks.push(toggleMutation.mutateAsync({ skillRef: row.skillRef, harness: cell.harness, nextState: "disabled" }));
          }
        }
      }
      await Promise.all(tasks);
    });
  }

  async function handleMultiSelectDelete(): Promise<void> {
    await runMultiSelect("delete", async (rows) => {
      await Promise.all(rows.map((row) => deleteMutation.mutateAsync({ skillRef: row.skillRef })));
    });
  }

  async function setSkillAllHarnesses(
    row: SkillListRow,
    target: SetAllHarnessesTarget,
  ): Promise<SetAllHarnessesResult> {
    const targets = row.cells.filter((cell) => cell.interactive && cell.state !== target);
    if (targets.length === 0) {
      return { succeeded: [], failed: [] };
    }
    // Mark every cell this drop would flip as pending so per-cell affordances
    // (dim overlays on the matrix + board) match reality while the single bulk
    // request is in flight.
    const pendingKeys = targets.map((cell) => cellActionKey(row.skillRef, cell.harness));
    pendingKeys.forEach((key) => toggleRegistry.begin(key));
    try {
      const outcome = await setHarnessesMutation.mutateAsync({ skillRef: row.skillRef, target });
      const failed: SetAllHarnessesFailure[] = outcome.failed.map((failure) => ({
        harness: failure.harness,
        error: new Error(failure.error),
      }));
      return { succeeded: outcome.succeeded, failed };
    } catch (error) {
      const reason = error instanceof Error ? error : new Error(String(error ?? "Unknown error"));
      return {
        succeeded: [],
        failed: targets.map((cell) => ({ harness: cell.harness, error: reason })),
      };
    } finally {
      pendingKeys.forEach((key) => toggleRegistry.finish(key));
    }
  }

  async function handleSetSkillAllHarnesses(
    skillRef: string,
    target: SetAllHarnessesTarget,
  ): Promise<SetAllHarnessesResult> {
    setActionErrorMessage("");
    const row = data?.rows.find((candidate) => candidate.skillRef === skillRef);
    if (!row) {
      return { succeeded: [], failed: [] };
    }
    const result = await setSkillAllHarnesses(row, target);
    if (result.failed.length > 0) {
      setActionErrorMessage(formatSingleSkillFailureMessage(row.name, target, result.failed));
    }
    return result;
  }

  async function handleSetManySkillsAllHarnesses(
    skillRefs: string[],
    target: SetAllHarnessesTarget,
  ): Promise<Map<string, SetAllHarnessesResult>> {
    setActionErrorMessage("");
    const refSet = new Set(skillRefs);
    const rows = data?.rows.filter((row) => refSet.has(row.skillRef)) ?? [];
    if (rows.length === 0) {
      return new Map();
    }
    const entries = await Promise.all(
      rows.map(async (row): Promise<[string, SetAllHarnessesResult]> => {
        const result = await setSkillAllHarnesses(row, target);
        return [row.skillRef, result];
      }),
    );
    const byRef = new Map(entries);
    const failingRows = rows
      .map((row) => ({ row, result: byRef.get(row.skillRef) }))
      .filter((entry): entry is { row: SkillListRow; result: SetAllHarnessesResult } =>
        Boolean(entry.result && entry.result.failed.length > 0),
      );
    if (failingRows.length > 0) {
      setActionErrorMessage(formatMultiSkillFailureMessage(failingRows, target));
    }
    return byRef;
  }

  const context: SkillsWorkspaceContextValue = {
    data,
    hasData,
    isInitialLoading,
    status,
    errorMessage: actionErrorMessage || (hasData ? queryErrorMessage : ""),
    pendingToggleKeys: toggleRegistry.pendingKeys,
    pendingStructuralActions,
    pendingBulkAction,
    selectedSkillRef,
    multiSelectedRefs,
    multiSelectPending,
    onManageAll: () => void handleManageAll(),
    onManageSkill: handleManageSkillFromList,
    onOpenSkill: handleOpenSkill,
    onToggleCell: handleToggleCell,
    onToggleMultiSelect: toggleMultiSelect,
    onClearMultiSelect: clearMultiSelect,
    onMultiSelectEnableAll: handleMultiSelectEnableAll,
    onMultiSelectDisableAll: handleMultiSelectDisableAll,
    onMultiSelectDelete: handleMultiSelectDelete,
    onSetSkillAllHarnesses: handleSetSkillAllHarnesses,
    onSetManySkillsAllHarnesses: handleSetManySkillsAllHarnesses,
    onUpdateSkill: handleUpdateSkill,
    onRemoveSkill: handleRemoveSkillFromList,
    onDeleteSkill: handleDeleteSkillFromList,
  };

  return {
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
    dismissActionError: () => setActionErrorMessage(""),
  };
}

function formatSingleSkillFailureMessage(
  name: string,
  target: SetAllHarnessesTarget,
  failures: SetAllHarnessesFailure[],
): string {
  const verb = target === "enabled" ? "enable" : "disable";
  const harnesses = failures.map((failure) => failure.harness).join(", ");
  return `Unable to ${verb} ${name} on ${harnesses}.`;
}

function formatMultiSkillFailureMessage(
  failingRows: Array<{ row: SkillListRow; result: SetAllHarnessesResult }>,
  target: SetAllHarnessesTarget,
): string {
  const verb = target === "enabled" ? "enable" : "disable";
  if (failingRows.length === 1) {
    const { row, result } = failingRows[0];
    return formatSingleSkillFailureMessage(row.name, target, result.failed);
  }
  const names = failingRows.map((entry) => entry.row.name).join(", ");
  return `Unable to ${verb} every harness for ${failingRows.length} skills: ${names}.`;
}
