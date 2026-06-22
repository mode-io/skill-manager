import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { queryPolicy } from "../../../lib/query";
import {
  adoptMcpServer,
  checkMcpServerAvailability,
  disableMcpServer,
  enableMcpServer,
  fetchMcpInventory,
  fetchMcpServerDetail,
  fetchMcpNeedsReviewByServer,
  reconcileMcpServer,
  setMcpServerHarnesses,
  uninstallMcpServer,
} from "./management-client";
import {
  applyMcpAvailabilityResult,
  applyMcpHarnessBindingState,
  removeMcpServerFromCache,
  invalidateMcpInventoryQueries,
  invalidateMcpQueries,
  invalidateMcpReviewQueries,
} from "./invalidation";
import { MCP_GC_TIME_MS, MCP_INVENTORY_REFETCH_INTERVAL_MS, MCP_STALE_TIME_MS, mcpManagementKeys } from "./keys";

export {
  invalidateMcpAvailabilityQueries,
  invalidateMcpInventoryQueries,
  invalidateMcpQueries,
  invalidateMcpReviewQueries,
} from "./invalidation";
export { mcpManagementKeys } from "./keys";

interface McpQueryOptions {
  enabled?: boolean;
}

export function useMcpInventoryQuery(options: McpQueryOptions = {}) {
  const enabled = options.enabled ?? true;
  return useQuery({
    queryKey: mcpManagementKeys.inventory(),
    queryFn: fetchMcpInventory,
    enabled,
    refetchInterval: enabled ? MCP_INVENTORY_REFETCH_INTERVAL_MS : false,
    ...queryPolicy(MCP_STALE_TIME_MS, MCP_GC_TIME_MS),
  });
}

export function useEnableMcpServerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: enableMcpServer,
    onSuccess: (_response, variables) => {
      applyMcpHarnessBindingState(queryClient, variables.name, variables.harness, "managed");
    },
    onSettled: () => {
      void invalidateMcpInventoryQueries(queryClient);
    },
  });
}

export function useDisableMcpServerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disableMcpServer,
    onSuccess: (_response, variables) => {
      applyMcpHarnessBindingState(queryClient, variables.name, variables.harness, "missing");
    },
    onSettled: () => {
      void invalidateMcpInventoryQueries(queryClient);
    },
  });
}

export function useSetMcpServerHarnessesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setMcpServerHarnesses,
    onSuccess: (response, variables) => {
      for (const harness of response.succeeded) {
        applyMcpHarnessBindingState(
          queryClient,
          variables.name,
          harness,
          variables.target === "enabled" ? "managed" : "missing",
        );
      }
    },
    onSettled: () => {
      void invalidateMcpInventoryQueries(queryClient);
    },
  });
}

export function useUninstallMcpServerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uninstallMcpServer,
    onSuccess: (_response, name) => {
      removeMcpServerFromCache(queryClient, name);
    },
    onSettled: () => {
      void Promise.all([
        invalidateMcpInventoryQueries(queryClient),
        invalidateMcpReviewQueries(queryClient),
      ]);
    },
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

export function useCheckMcpServerAvailabilityMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: checkMcpServerAvailability,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    onSuccess: (response) => {
      applyMcpAvailabilityResult(queryClient, response);
    },
  });
}

export function useMcpNeedsReviewByServerQuery(options: McpQueryOptions = {}) {
  return useQuery({
    queryKey: mcpManagementKeys.needsReviewByServer(),
    queryFn: fetchMcpNeedsReviewByServer,
    enabled: options.enabled ?? true,
    ...queryPolicy(MCP_STALE_TIME_MS, MCP_GC_TIME_MS),
  });
}

export function useReconcileMcpServerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reconcileMcpServer,
    onSettled: () => {
      void Promise.all([
        invalidateMcpInventoryQueries(queryClient),
        invalidateMcpReviewQueries(queryClient),
      ]);
    },
  });
}

export function useAdoptMcpServerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adoptMcpServer,
    onSettled: () => {
      void Promise.all([
        invalidateMcpInventoryQueries(queryClient),
        invalidateMcpReviewQueries(queryClient),
      ]);
    },
  });
}
