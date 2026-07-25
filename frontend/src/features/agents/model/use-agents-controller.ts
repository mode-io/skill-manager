import { useState, useCallback } from "react";
import {
  useAgentsInventoryQuery,
  useEnableAgentMutation,
  useDisableAgentMutation,
  useAdoptAgentMutation,
  useAdoptAllAgentsMutation,
  useDeleteAgentMutation,
  useUpdateAgentMutation,
  useCreateAgentMutation,
} from "../api/queries";

export function useAgentsController() {
  const inventoryQuery = useAgentsInventoryQuery();
  const enableMutation = useEnableAgentMutation();
  const disableMutation = useDisableAgentMutation();
  const adoptMutation = useAdoptAgentMutation();
  const adoptAllMutation = useAdoptAllAgentsMutation();
  const deleteMutation = useDeleteAgentMutation();
  const updateMutation = useUpdateAgentMutation();
  const createMutation = useCreateAgentMutation();

  const [pendingAgentKeys, setPendingAgentKeys] = useState<ReadonlySet<string>>(new Set());
  const [pendingPerHarnessKeys, setPendingPerHarnessKeys] = useState<ReadonlySet<string>>(new Set());
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  const inventory = inventoryQuery.data ?? null;

  const handleToggleHarness = useCallback(
    async (ref: string, harness: string, disable: boolean) => {
      const key = `${ref}:${harness}`;
      setPendingPerHarnessKeys((curr) => {
        const next = new Set(curr);
        next.add(key);
        return next;
      });
      setActionErrorMessage(null);
      try {
        if (disable) {
          await disableMutation.mutateAsync({ ref, harness });
        } else {
          await enableMutation.mutateAsync({ ref, harness });
        }
      } catch (err) {
        setActionErrorMessage(err instanceof Error ? (err as any).error || err.toString() : "Failed to toggle harness");
      } finally {
        setPendingPerHarnessKeys((curr) => {
          const next = new Set(curr);
          next.delete(key);
          return next;
        });
      }
    },
    [enableMutation, disableMutation]
  );

  return {
    status: inventoryQuery.status,
    inventory,
    isInitialLoading: inventoryQuery.isPending && !inventory,
    queryErrorMessage: inventoryQuery.error instanceof Error ? inventoryQuery.error.message : null,
    actionErrorMessage,
    clearActionError: () => setActionErrorMessage(null),
    pendingAgentKeys,
    pendingPerHarnessKeys,
    handleToggleHarness,
    adoptMutation,
    adoptAllMutation,
    deleteMutation,
    updateMutation,
    createMutation,
  };
}
