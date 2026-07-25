import { useCallback, useState } from "react";

import { usePendingRegistry } from "../../../lib/async/pending-registry";
import {
  useCreatePermissionMutation,
  useDisablePermissionMutation,
  useEnablePermissionMutation,
  usePermissionsInventoryQuery,
  useReconcilePermissionMutation,
  useSetPermissionHarnessesMutation,
  useUninstallPermissionMutation,
} from "../api/management-queries";

export type PermissionsStatus = "loading" | "ready" | "error";

export function usePermissionsManagementController() {
  const inventoryQuery = usePermissionsInventoryQuery();
  const setHarnessesMutation = useSetPermissionHarnessesMutation();
  const uninstallMutation = useUninstallPermissionMutation();
  const reconcileMutation = useReconcilePermissionMutation();
  const enableMutation = useEnablePermissionMutation();
  const disableMutation = useDisablePermissionMutation();
  const createMutation = useCreatePermissionMutation();

  const pendingPermissionRegistry = usePendingRegistry<string>();
  const pendingPerHarnessRegistry = usePendingRegistry<string>(); // key: id:harness

  const [actionErrorMessage, setActionErrorMessage] = useState("");
  const [selectedPermissionId, setSelectedPermissionId] = useState<string | null>(null);

  const inventory = inventoryQuery.data ?? null;
  const isInitialLoading = inventoryQuery.isPending && !inventory;
  const queryErrorMessage =
    inventoryQuery.error instanceof Error ? inventoryQuery.error.message : "";
  const status: PermissionsStatus = isInitialLoading
    ? "loading"
    : inventory
      ? "ready"
      : queryErrorMessage
        ? "error"
        : "loading";

  const handleSetPermissionHarnesses = useCallback(
    async (
      id: string,
      target: "enabled" | "disabled",
    ): Promise<void> => {
      try {
        await pendingPermissionRegistry.run(id, async () => {
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
    [pendingPermissionRegistry, setHarnessesMutation],
  );

  const handleUninstallPermission = useCallback(
    async (id: string): Promise<void> => {
      try {
        await pendingPermissionRegistry.run(id, async () => {
          const response = await uninstallMutation.mutateAsync(id);
          if (!response.ok) {
            const failed = response.failed.map((f) => `${f.harness}: ${f.error}`).join("; ");
            setActionErrorMessage(failed || "Could not delete permission cleanly");
          } else {
            if (selectedPermissionId === id) {
              setSelectedPermissionId(null);
            }
          }
        });
      } catch (error) {
        setActionErrorMessage(error instanceof Error ? error.message : "Action failed");
      }
    },
    [pendingPermissionRegistry, selectedPermissionId, uninstallMutation],
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

  const handleReconcilePermission = useCallback(
    async (args: {
      id: string;
      sourceKind: "managed" | "harness";
      observedHarness?: string | null;
      harnesses?: string[];
    }): Promise<void> => {
      try {
        await pendingPermissionRegistry.run(args.id, async () => {
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
    [pendingPermissionRegistry, reconcileMutation],
  );

  const handleCreatePermission = useCallback(
    async (permission: {
      id: string;
      decision: string;
      scope: string;
      pattern?: string | null;
      description?: string;
    }): Promise<void> => {
      try {
        await createMutation.mutateAsync(permission);
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
    selectedPermissionId,
    setSelectedPermissionId,
    pendingPermissionKeys: pendingPermissionRegistry.pendingKeys,
    pendingPerHarnessKeys: pendingPerHarnessRegistry.pendingKeys,
    handleSetPermissionHarnesses,
    handleUninstallPermission,
    handleToggleHarness,
    handleReconcilePermission,
    handleCreatePermission,
  };
}
export type PermissionsManagementController = ReturnType<typeof usePermissionsManagementController>;
