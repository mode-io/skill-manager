import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { queryPolicy } from "../../../lib/query";
import {
  adoptMcpServer,
  disableMcpServer,
  enableMcpServer,
  fetchMcpInventory,
  fetchMcpServerDetail,
  fetchMcpNeedsReviewByServer,
  reconcileMcpServer,
  setMcpServerHarnesses,
  uninstallMcpServer,
} from "./management-client";
import { invalidateMcpQueries } from "./invalidation";
import { MCP_GC_TIME_MS, MCP_STALE_TIME_MS, mcpManagementKeys } from "./keys";

export { invalidateMcpQueries } from "./invalidation";
export { mcpManagementKeys } from "./keys";

export function useMcpInventoryQuery() {
  return useQuery({
    queryKey: mcpManagementKeys.inventory(),
    queryFn: fetchMcpInventory,
    ...queryPolicy(MCP_STALE_TIME_MS, MCP_GC_TIME_MS),
  });
}

export function useEnableMcpServerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: enableMcpServer,
    onSettled: () => invalidateMcpQueries(queryClient),
  });
}

export function useDisableMcpServerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disableMcpServer,
    onSettled: () => invalidateMcpQueries(queryClient),
  });
}

export function useSetMcpServerHarnessesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setMcpServerHarnesses,
    onSettled: () => invalidateMcpQueries(queryClient),
  });
}

export function useUninstallMcpServerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uninstallMcpServer,
    onSettled: () => invalidateMcpQueries(queryClient),
  });
}

export function useMcpServerDetailQuery(name: string | null) {
  return useQuery({
    queryKey: mcpManagementKeys.detail(name ?? "__none__"),
    queryFn: () => fetchMcpServerDetail(name!),
    enabled: Boolean(name),
    ...queryPolicy(MCP_STALE_TIME_MS, MCP_GC_TIME_MS),
  });
}

export function useMcpNeedsReviewByServerQuery() {
  return useQuery({
    queryKey: mcpManagementKeys.needsReviewByServer(),
    queryFn: fetchMcpNeedsReviewByServer,
    ...queryPolicy(MCP_STALE_TIME_MS, MCP_GC_TIME_MS),
  });
}

export function useReconcileMcpServerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reconcileMcpServer,
    onSettled: () => invalidateMcpQueries(queryClient),
  });
}

export function useAdoptMcpServerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adoptMcpServer,
    onSettled: () => invalidateMcpQueries(queryClient),
  });
}
