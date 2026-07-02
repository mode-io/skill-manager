import { useCallback, useState } from "react";

import { usePendingRegistry } from "../../../lib/async/pending-registry";
import {
  useCreateHookMutation,
  useDisableHookMutation,
  useEnableHookMutation,
  useHooksInventoryQuery,
  useReconcileHookMutation,
  useSetHookHarnessesMutation,
  useUninstallHookMutation,
} from "../api/management-queries";

export type HooksStatus = "loading" | "ready" | "error";

export function useHooksManagementController() {
  const inventoryQuery = useHooksInventoryQuery();
  const setHarnessesMutation = useSetHookHarnessesMutation();
  const uninstallMutation = useUninstallHookMutation();
  const reconcileMutation = useReconcileHookMutation();
  const enableMutation = useEnableHookMutation();
  const disableMutation = useDisableHookMutation();
  const createMutation = useCreateHookMutation();

  const pendingHookRegistry = usePendingRegistry<string>();
  const pendingPerHarnessRegistry = usePendingRegistry<string>(); // key: id:harness

  const [actionErrorMessage, setActionErrorMessage] = useState("");
  const [selectedHookId, setSelectedHookId] = useState<string | null>(null);

  const inventory = inventoryQuery.data ?? null;
  const isInitialLoading = inventoryQuery.isPending && !inventory;
  const queryErrorMessage =
    inventoryQuery.error instanceof Error ? inventoryQuery.error.message : "";
  const status: HooksStatus = isInitialLoading
    ? "loading"
    : inventory
      ? "ready"
      : queryErrorMessage
        ? "error"
        : "loading";

  const handleSetHookHarnesses = useCallback(
    async (
      id: string,
      target: "enabled" | "disabled",
    ): Promise<void> => {
      try {
        await pendingHookRegistry.run(id, async () => {
          const response = await setHarnessesMutation.mutateAsync({ id, target });
          if (!response.ok) {
            const failed = response.failed.map((f) => `${f.harness}: ${f.error}`).join("; ");
            setActionErrorMessage(failed || "Some harnesses could not be updated");
          }
        });
      } catch (error) {
        setActionErrorMessage(error instanceof Error ? error.message : "Action failed");
      }
    },
    [pendingHookRegistry, setHarnessesMutation],
  );

  const handleUninstallHook = useCallback(
    async (id: string): Promise<void> => {
      try {
        await pendingHookRegistry.run(id, async () => {
          const response = await uninstallMutation.mutateAsync(id);
          if (!response.ok) {
            const failed = response.failed.map((f) => `${f.harness}: ${f.error}`).join("; ");
            setActionErrorMessage(failed || "Could not delete hook cleanly");
          } else {
            if (selectedHookId === id) {
              setSelectedHookId(null);
            }
          }
        });
      } catch (error) {
        setActionErrorMessage(error instanceof Error ? error.message : "Action failed");
      }
    },
    [pendingHookRegistry, selectedHookId, uninstallMutation],
  );

  const handleToggleHarness = useCallback(
    async (id: string, harness: string, currentEnabled: boolean): Promise<void> => {
      const pendingKey = `${id}:${harness}`;
      try {
        await pendingPerHarnessRegistry.run(pendingKey, async () => {
          if (currentEnabled) {
            await disableMutation.mutateAsync({ id, harness });
          } else {
            await enableMutation.mutateAsync({ id, harness });
          }
        });
      } catch (error) {
        setActionErrorMessage(error instanceof Error ? error.message : "Action failed");
      }
    },
    [disableMutation, enableMutation, pendingPerHarnessRegistry],
  );

  const handleReconcileHook = useCallback(
    async (args: {
      id: string;
      sourceKind: "managed" | "harness";
      observedHarness?: string | null;
      harnesses?: string[];
    }): Promise<void> => {
      try {
        await pendingHookRegistry.run(args.id, async () => {
          const response = await reconcileMutation.mutateAsync(args);
          if (!response.ok) {
            const failed = response.failed.map((f) => `${f.harness}: ${f.error}`).join("; ");
            setActionErrorMessage(failed || "Reconciliation failed");
          }
        });
      } catch (error) {
        setActionErrorMessage(error instanceof Error ? error.message : "Action failed");
      }
    },
    [pendingHookRegistry, reconcileMutation],
  );

  const handleCreateHook = useCallback(
    async (hook: {
      id: string;
      event: string;
      command: string;
      match?: string | null;
      timeout?: number | null;
      description?: string;
    }): Promise<void> => {
      try {
        await createMutation.mutateAsync(hook);
      } catch (error) {
        setActionErrorMessage(error instanceof Error ? error.message : "Action failed");
        throw error;
      }
    },
    [createMutation],
  );

  const clearActionError = useCallback(() => {
    setActionErrorMessage("");
  }, []);

  return {
    inventory,
    status,
    isInitialLoading,
    queryErrorMessage,
    actionErrorMessage,
    clearActionError,
    selectedHookId,
    setSelectedHookId,
    pendingHookKeys: pendingHookRegistry.pendingKeys,
    pendingPerHarnessKeys: pendingPerHarnessRegistry.pendingKeys,
    handleSetHookHarnesses,
    handleUninstallHook,
    handleToggleHarness,
    handleReconcileHook,
    handleCreateHook,
  };
}
export type HooksManagementController = ReturnType<typeof useHooksManagementController>;
