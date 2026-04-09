import { useEffect, useRef, useState } from "react";

import type { HarnessCellState } from "./types";
import { useSkillDetailQuery } from "../api/queries";

interface SkillDetailMutationHandlers {
  onManageSkill: (skillRef: string) => Promise<void>;
  onToggleSkill: (skillRef: string, harness: string, currentState: HarnessCellState) => Promise<void>;
  onUpdateSkill: (skillRef: string) => Promise<void>;
  onUnmanageSkill: (skillRef: string) => Promise<void>;
  onDeleteSkill: (skillRef: string) => Promise<void>;
}

export function useSkillDetailController(
  skillRef: string,
  handlers: SkillDetailMutationHandlers,
) {
  const detailQuery = useSkillDetailQuery(skillRef);
  const [actionErrorMessage, setActionErrorMessage] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [isStopManagingDialogOpen, setStopManagingDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const isMountedRef = useRef(true);

  const detail = detailQuery.data ?? null;
  const isInitialLoading = detailQuery.isPending && detail === null;
  const isRefreshing = detailQuery.isFetching && detail !== null;
  const queryErrorMessage = detailQuery.error instanceof Error ? detailQuery.error.message : "";

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  useEffect(() => {
    setActionErrorMessage("");
    setBusyAction(null);
    setStopManagingDialogOpen(false);
    setDeleteDialogOpen(false);
  }, [skillRef]);

  async function runAction(actionKey: string, task: () => Promise<unknown>): Promise<boolean> {
    try {
      if (isMountedRef.current) {
        setBusyAction(actionKey);
        setActionErrorMessage("");
      }
      await task();
      return true;
    } catch (error) {
      if (isMountedRef.current) {
        setActionErrorMessage(error instanceof Error ? error.message : "Unable to complete the action.");
      }
      return false;
    } finally {
      if (isMountedRef.current) {
        setBusyAction(null);
      }
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!detail) {
      return;
    }
    const didSucceed = await runAction("delete", () => handlers.onDeleteSkill(detail.skillRef));
    if (!didSucceed) {
      setDeleteDialogOpen(false);
    }
  }

  async function handleConfirmStopManaging(): Promise<void> {
    if (!detail) {
      return;
    }
    const didSucceed = await runAction("unmanage", () => handlers.onUnmanageSkill(detail.skillRef));
    if (!didSucceed) {
      setStopManagingDialogOpen(false);
    }
  }

  return {
    detail,
    isInitialLoading,
    isRefreshing,
    queryErrorMessage,
    actionErrorMessage,
    busyAction,
    isStopManagingDialogOpen,
    isDeleteDialogOpen,
    dismissActionError: () => setActionErrorMessage(""),
    onManage: () => detail && void runAction("manage", () => handlers.onManageSkill(detail.skillRef)),
    onToggleHarness: (harness: string, currentState: HarnessCellState) =>
      detail && void runAction(`toggle:${harness}`, () => handlers.onToggleSkill(detail.skillRef, harness, currentState)),
    onUpdate: () => detail && void runAction("update", () => handlers.onUpdateSkill(detail.skillRef)),
    requestStopManaging: () => {
      setActionErrorMessage("");
      setStopManagingDialogOpen(true);
    },
    requestDelete: () => {
      setActionErrorMessage("");
      setDeleteDialogOpen(true);
    },
    setStopManagingDialogOpen,
    setDeleteDialogOpen,
    handleConfirmDelete,
    handleConfirmStopManaging,
  };
}
