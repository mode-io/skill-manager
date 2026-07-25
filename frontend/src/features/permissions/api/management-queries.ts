import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { queryPolicy } from "../../../lib/query";
import {
  createPermission,
  disablePermission,
  enablePermission,
  fetchPermissionsInventory,
  fetchPermissionDetail,
  promotePermission,
  reconcilePermission,
  setPermissionHarnesses,
  uninstallPermission,
} from "./management-client";
import { invalidatePermissionsQueries } from "./invalidation";
import { HOOKS_GC_TIME_MS, HOOKS_INVENTORY_REFETCH_INTERVAL_MS, HOOKS_STALE_TIME_MS, permissionsManagementKeys } from "./keys";

export { invalidatePermissionsQueries } from "./invalidation";
export { permissionsManagementKeys } from "./keys";

export function usePermissionsInventoryQuery() {
  return useQuery({
    queryKey: permissionsManagementKeys.inventory(),
    queryFn: fetchPermissionsInventory,
    refetchInterval: HOOKS_INVENTORY_REFETCH_INTERVAL_MS,
    ...queryPolicy(HOOKS_STALE_TIME_MS, HOOKS_GC_TIME_MS),
  });
}

export function useEnablePermissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: enablePermission,
    onSettled: () => invalidatePermissionsQueries(queryClient),
  });
}

export function useDisablePermissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disablePermission,
    onSettled: () => invalidatePermissionsQueries(queryClient),
  });
}

export function useSetPermissionHarnessesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setPermissionHarnesses,
    onSettled: () => invalidatePermissionsQueries(queryClient),
  });
}

export function useUninstallPermissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uninstallPermission,
    onSettled: () => invalidatePermissionsQueries(queryClient),
  });
}

export function usePermissionDetailQuery(id: string | null) {
  return useQuery({
    queryKey: permissionsManagementKeys.detail(id ?? "__none__"),
    queryFn: () => fetchPermissionDetail(id!),
    enabled: Boolean(id),
    ...queryPolicy(HOOKS_STALE_TIME_MS, HOOKS_GC_TIME_MS),
  });
}

export function useCreatePermissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPermission,
    onSettled: () => invalidatePermissionsQueries(queryClient),
  });
}

export function usePromotePermissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: promotePermission,
    onSettled: () => invalidatePermissionsQueries(queryClient),
  });
}

export function useReconcilePermissionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reconcilePermission,
    onSettled: () => invalidatePermissionsQueries(queryClient),
  });
}
