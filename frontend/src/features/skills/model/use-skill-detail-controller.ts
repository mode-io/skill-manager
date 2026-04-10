import { useEffect, useRef, useState } from "react";

import type { HarnessCellState } from "./types";
import { useSkillDetailQuery, useSkillSourceStatusQuery } from "../api/queries";

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
  const sourceStatusQuery = useSkillSourceStatusQuery(skillRef);
  const [actionErrorMessage, setActionErrorMessage] = useState("");
  const [isStopManagingDialogOpen, setStopManagingDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const isMountedRef = useRef(true);

  const detail = detailQuery.data
    ? {
        ...detailQuery.data,
        actions: {
          ...detailQuery.data.actions,
          updateStatus: sourceStatusQuery.data?.updateStatus ?? null,
        },
      }
    : null;
  const isInitialLoading = detailQuery.isPending && detail === null;
  const queryErrorMessage = detailQuery.error instanceof Error
    ? detailQuery.error.message
    : sourceStatusQuery.error instanceof Error
      ? sourceStatusQuery.error.message
      : "";

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  useEffect(() => {
    setActionErrorMessage("");
    setStopManagingDialogOpen(false);
    setDeleteDialogOpen(false);
  }, [skillRef]);

  async function runAction(task: () => Promise<unknown>): Promise<boolean> {
    try {
      if (isMountedRef.current) {
        setActionErrorMessage("");
      }
      await task();
      return true;
    } catch (error) {
      if (isMountedRef.current) {
        setActionErrorMessage(error instanceof Error ? error.message : "Unable to complete the action.");
      }
      return false;
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!detail) {
      return;
    }
    const didSucceed = await runAction(() => handlers.onDeleteSkill(detail.skillRef));
    if (didSucceed && isMountedRef.current) {
      setDeleteDialogOpen(false);
    }
  }

  async function handleConfirmStopManaging(): Promise<void> {
    if (!detail) {
      return;
    }
    const didSucceed = await runAction(() => handlers.onUnmanageSkill(detail.skillRef));
    if (didSucceed && isMountedRef.current) {
      setStopManagingDialogOpen(false);
    }
  }

  return {
    detail,
    isInitialLoading,
    queryErrorMessage,
    actionErrorMessage,
    isStopManagingDialogOpen,
    isDeleteDialogOpen,
    dismissActionError: () => setActionErrorMessage(""),
    onManage: () => detail && void runAction(() => handlers.onManageSkill(detail.skillRef)),
    onToggleHarness: (harness: string, currentState: HarnessCellState) =>
      detail && void runAction(() => handlers.onToggleSkill(detail.skillRef, harness, currentState)),
    onUpdate: () => detail && void runAction(() => handlers.onUpdateSkill(detail.skillRef)),
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
