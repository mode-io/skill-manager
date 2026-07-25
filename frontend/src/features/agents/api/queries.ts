import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAgentsInventory, fetchAgentDetail, createAgent, updateAgent, adoptAgent, adoptAllAgents, deleteAgent, enableAgent, disableAgent } from "./client";
import { agentsKeys } from "./keys";
import type { AgentAdoptConflict, AdoptAllResponse } from "./types";

export function useAgentsInventoryQuery() {
  return useQuery({
    queryKey: agentsKeys.list(),
    queryFn: fetchAgentsInventory,
  });
}

export function useAgentDetailQuery(ref: string) {
  return useQuery({
    queryKey: agentsKeys.detail(ref),
    queryFn: () => fetchAgentDetail(ref),
  });
}

export function useEnableAgentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ref, harness }: { ref: string; harness: string }) => enableAgent(ref, harness),
    onSuccess: (_, { ref }) => {
      queryClient.invalidateQueries({ queryKey: agentsKeys.list() });
      queryClient.invalidateQueries({ queryKey: agentsKeys.detail(ref) });
    },
  });
}

export function useDisableAgentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ref, harness }: { ref: string; harness: string }) => disableAgent(ref, harness),
    onSuccess: (_, { ref }) => {
      queryClient.invalidateQueries({ queryKey: agentsKeys.list() });
      queryClient.invalidateQueries({ queryKey: agentsKeys.detail(ref) });
    },
  });
}

export function useAdoptAgentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ref, onConflict }: { ref: string; onConflict?: "keep_store" | "replace_store" }) => adoptAgent(ref, onConflict),
    onSuccess: (data) => {
      if (!data || !("conflict" in data)) {
        queryClient.invalidateQueries({ queryKey: agentsKeys.list() });
      }
    },
  });
}

export function useAdoptAllAgentsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => adoptAllAgents(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentsKeys.list() });
    },
  });
}

export function useDeleteAgentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentsKeys.list() });
    },
  });
}

export function useUpdateAgentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ref, request }: Parameters<typeof updateAgent>[0] & { ref: string }) => updateAgent({ ref, request }),
    onSuccess: (_, { ref }) => {
      queryClient.invalidateQueries({ queryKey: agentsKeys.list() });
      queryClient.invalidateQueries({ queryKey: agentsKeys.detail(ref) });
    },
  });
}

export function useCreateAgentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: Parameters<typeof createAgent>[0]) => createAgent(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentsKeys.list() });
    },
  });
}
