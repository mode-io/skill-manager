import { useCallback, useState } from "react";

import type { MultiSelectAction } from "../../../components/BulkActionBar";
import { usePendingRegistry } from "../../../lib/async/pending-registry";
import {
  useAdoptMcpServerMutation,
  useDisableMcpServerMutation,
  useEnableMcpServerMutation,
  useMcpInventoryQuery,
  useMcpNeedsReviewByServerQuery,
  useReconcileMcpServerMutation,
  useSetMcpServerHarnessesMutation,
  useUninstallMcpServerMutation,
} from "../api/management-queries";

export type McpStatus = "loading" | "ready" | "error";

export function useMcpManagementController() {
  const inventoryQuery = useMcpInventoryQuery();
  const needsReviewByServerQuery = useMcpNeedsReviewByServerQuery();
  const setHarnessesMutation = useSetMcpServerHarnessesMutation();
  const uninstallMutation = useUninstallMcpServerMutation();
  const adoptMutation = useAdoptMcpServerMutation();
  const reconcileMutation = useReconcileMcpServerMutation();
  const enableMutation = useEnableMcpServerMutation();
  const disableMutation = useDisableMcpServerMutation();

  const pendingServerRegistry = usePendingRegistry<string>();
  const pendingAdoptRegistry = usePendingRegistry<string>(); // key: name or name:sourceHarness
  const pendingPerHarnessRegistry = usePendingRegistry<string>(); // key: name:harness

  const [actionErrorMessage, setActionErrorMessage] = useState("");
  const [multiSelectedNames, setMultiSelectedNames] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [multiSelectPending, setMultiSelectPending] = useState<MultiSelectAction | null>(null);

  const inventory = inventoryQuery.data ?? null;
  const needsReviewByServer = needsReviewByServerQuery.data ?? null;
  const isInitialLoading = inventoryQuery.isPending && !inventory;
  const isNeedsReviewByServerLoading =
    needsReviewByServerQuery.isPending && !needsReviewByServer;
  const queryErrorMessage =
    inventoryQuery.error instanceof Error ? inventoryQuery.error.message : "";
  const status: McpStatus = isInitialLoading
    ? "loading"
    : inventory
      ? "ready"
      : queryErrorMessage
        ? "error"
        : "loading";

  const handleSetServerHarnesses = useCallback(
    async (name: string, target: "enabled" | "disabled"): Promise<void> => {
      try {
        await pendingServerRegistry.run(name, async () => {
          const response = await setHarnessesMutation.mutateAsync({ name, target });
          if (!response.ok) {
            const failed = response.failed.map((f) => `${f.harness}: ${f.error}`).join("; ");
            setActionErrorMessage(failed || "Some harnesses could not be updated");
          }
        });
      } catch (error) {
        setActionErrorMessage(error instanceof Error ? error.message : "Action failed");
      }
    },
    [pendingServerRegistry, setHarnessesMutation],
  );

  const handleUninstallServer = useCallback(
    async (name: string): Promise<void> => {
      try {
        await pendingServerRegistry.run(name, async () => {
          await uninstallMutation.mutateAsync(name);
        });
      } catch (error) {
        setActionErrorMessage(error instanceof Error ? error.message : "Uninstall failed");
      }
    },
    [pendingServerRegistry, uninstallMutation],
  );

  // Per-harness enable/disable from detail sheet binding matrix ----------

  const handleEnableInHarness = useCallback(
    async (name: string, harness: string): Promise<void> => {
      const key = `${name}:${harness}`;
      try {
        await pendingPerHarnessRegistry.run(key, async () => {
          await enableMutation.mutateAsync({ name, harness });
        });
      } catch (error) {
        setActionErrorMessage(error instanceof Error ? error.message : "Enable failed");
      }
    },
    [enableMutation, pendingPerHarnessRegistry],
  );

  const handleDisableInHarness = useCallback(
    async (name: string, harness: string): Promise<void> => {
      const key = `${name}:${harness}`;
      try {
        await pendingPerHarnessRegistry.run(key, async () => {
          await disableMutation.mutateAsync({ name, harness });
        });
      } catch (error) {
        setActionErrorMessage(error instanceof Error ? error.message : "Disable failed");
      }
    },
    [disableMutation, pendingPerHarnessRegistry],
  );

  const handleResolveConfig = useCallback(
    async (
      name: string,
      args: {
        sourceKind: "managed" | "harness";
        sourceHarness?: string | null;
        harnesses?: string[];
      },
    ): Promise<void> => {
      try {
        await pendingServerRegistry.run(name, async () => {
          await reconcileMutation.mutateAsync({ name, ...args });
        });
      } catch (error) {
        setActionErrorMessage(error instanceof Error ? error.message : "Resolve failed");
        throw error;
      }
    },
    [pendingServerRegistry, reconcileMutation],
  );

  // Adopt a config found in local harnesses ------------------------------

  const handleAdoptConfig = useCallback(
    async (
      name: string,
      args: { sourceHarness?: string | null; harnesses?: string[] } = {},
    ): Promise<void> => {
      const key = args.sourceHarness ? `${name}:${args.sourceHarness}` : name;
      try {
        await pendingAdoptRegistry.run(key, async () => {
          await adoptMutation.mutateAsync({ name, ...args });
        });
      } catch (error) {
        setActionErrorMessage(error instanceof Error ? error.message : "Adopt failed");
        throw error;
      }
    },
    [adoptMutation, pendingAdoptRegistry],
  );

  // Multi-select for servers in use ----------------------------------------

  const handleToggleMultiSelect = useCallback((name: string) => {
    setMultiSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const handleClearMultiSelect = useCallback(() => {
    setMultiSelectedNames(new Set());
  }, []);

  const runBulkAction = useCallback(
    async (
      action: MultiSelectAction,
      fn: (name: string) => Promise<unknown>,
    ): Promise<void> => {
      if (multiSelectedNames.size === 0) return;
      const names = Array.from(multiSelectedNames);
      setMultiSelectPending(action);
      setActionErrorMessage("");
      try {
        const results = await Promise.allSettled(names.map((name) => fn(name)));
        const failures = results
          .map((result, i) => ({ name: names[i], result }))
          .filter((x) => x.result.status === "rejected");
        if (failures.length > 0) {
          const detail = failures
            .map((f) => {
              const reason = (f.result as PromiseRejectedResult).reason;
              return `${f.name}: ${reason instanceof Error ? reason.message : reason}`;
            })
            .join("; ");
          setActionErrorMessage(detail);
        } else {
          setMultiSelectedNames(new Set());
        }
      } finally {
        setMultiSelectPending(null);
      }
    },
    [multiSelectedNames],
  );

  const handleMultiSelectEnableAll = useCallback(async (): Promise<void> => {
    await runBulkAction("enable-all", async (name) => {
      await setHarnessesMutation.mutateAsync({ name, target: "enabled" });
    });
  }, [runBulkAction, setHarnessesMutation]);

  const handleMultiSelectDisableAll = useCallback(async (): Promise<void> => {
    await runBulkAction("disable-all", async (name) => {
      await setHarnessesMutation.mutateAsync({ name, target: "disabled" });
    });
  }, [runBulkAction, setHarnessesMutation]);

  const handleMultiSelectUninstall = useCallback(async (): Promise<void> => {
    await runBulkAction("delete", async (name) => {
      await uninstallMutation.mutateAsync(name);
    });
  }, [runBulkAction, uninstallMutation]);

  const dismissActionError = useCallback(() => setActionErrorMessage(""), []);

  return {
    status,
    inventory,
    needsReviewByServer,
    isInitialLoading,
    isNeedsReviewByServerLoading,
    pendingServerKeys: pendingServerRegistry.pendingKeys,
    pendingAdoptKeys: pendingAdoptRegistry.pendingKeys,
    pendingPerHarnessKeys: pendingPerHarnessRegistry.pendingKeys,
    queryErrorMessage,
    actionErrorMessage,
    dismissActionError,
    handleSetServerHarnesses,
    handleUninstallServer,
    handleEnableInHarness,
    handleDisableInHarness,
    handleResolveConfig,
    handleAdoptConfig,
    multiSelectedNames,
    multiSelectPending,
    handleToggleMultiSelect,
    handleClearMultiSelect,
    handleMultiSelectEnableAll,
    handleMultiSelectDisableAll,
    handleMultiSelectUninstall,
  };
}

export type McpManagementController = ReturnType<typeof useMcpManagementController>;
