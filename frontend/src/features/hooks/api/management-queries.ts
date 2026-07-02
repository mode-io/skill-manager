import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { queryPolicy } from "../../../lib/query";
import {
  createHook,
  disableHook,
  enableHook,
  fetchHooksInventory,
  fetchHookDetail,
  reconcileHook,
  setHookHarnesses,
  uninstallHook,
} from "./management-client";
import { invalidateHooksQueries } from "./invalidation";
import { HOOKS_GC_TIME_MS, HOOKS_INVENTORY_REFETCH_INTERVAL_MS, HOOKS_STALE_TIME_MS, hooksManagementKeys } from "./keys";

export { invalidateHooksQueries } from "./invalidation";
export { hooksManagementKeys } from "./keys";

export function useHooksInventoryQuery() {
  return useQuery({
    queryKey: hooksManagementKeys.inventory(),
    queryFn: fetchHooksInventory,
    refetchInterval: HOOKS_INVENTORY_REFETCH_INTERVAL_MS,
    ...queryPolicy(HOOKS_STALE_TIME_MS, HOOKS_GC_TIME_MS),
  });
}

export function useEnableHookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: enableHook,
    onSettled: () => invalidateHooksQueries(queryClient),
  });
}

export function useDisableHookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disableHook,
    onSettled: () => invalidateHooksQueries(queryClient),
  });
}

export function useSetHookHarnessesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setHookHarnesses,
    onSettled: () => invalidateHooksQueries(queryClient),
  });
}

export function useUninstallHookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uninstallHook,
    onSettled: () => invalidateHooksQueries(queryClient),
  });
}

export function useHookDetailQuery(id: string | null) {
  return useQuery({
    queryKey: hooksManagementKeys.detail(id ?? "__none__"),
    queryFn: () => fetchHookDetail(id!),
    enabled: Boolean(id),
    ...queryPolicy(HOOKS_STALE_TIME_MS, HOOKS_GC_TIME_MS),
  });
}

export function useCreateHookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createHook,
    onSettled: () => invalidateHooksQueries(queryClient),
  });
}

export function useReconcileHookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reconcileHook,
    onSettled: () => invalidateHooksQueries(queryClient),
  });
}
