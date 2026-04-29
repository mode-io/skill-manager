import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { queryPolicy } from "../../../lib/query";
import {
  createSlashCommand,
  deleteSlashCommand,
  fetchSlashCommands,
  importSlashCommand,
  resolveSlashCommandReview,
  syncSlashCommand,
  updateSlashCommand,
} from "./client";
import {
  SLASH_COMMANDS_GC_TIME_MS,
  SLASH_COMMANDS_STALE_TIME_MS,
  slashCommandKeys,
} from "./keys";
import type {
  SlashCommandMutationRequest,
  SlashCommandResolveRequest,
  SlashCommandUpdateRequest,
  SlashSyncRequest,
} from "./types";

export { slashCommandKeys } from "./keys";

export function useSlashCommandsQuery() {
  return useQuery({
    queryKey: slashCommandKeys.list(),
    queryFn: fetchSlashCommands,
    ...queryPolicy(SLASH_COMMANDS_STALE_TIME_MS, SLASH_COMMANDS_GC_TIME_MS),
  });
}

export async function invalidateSlashCommandQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: slashCommandKeys.all });
}

export function useCreateSlashCommandMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SlashCommandMutationRequest) => createSlashCommand(body),
    onSuccess: () => {
      void invalidateSlashCommandQueries(queryClient);
    },
  });
}

export function useUpdateSlashCommandMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: SlashCommandUpdateRequest }) =>
      updateSlashCommand(name, body),
    onSuccess: () => {
      void invalidateSlashCommandQueries(queryClient);
    },
  });
}

export function useSyncSlashCommandMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: SlashSyncRequest }) =>
      syncSlashCommand(name, body),
    onSuccess: async () => invalidateSlashCommandQueries(queryClient),
  });
}

export function useDeleteSlashCommandMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name }: { name: string }) => deleteSlashCommand(name),
    onSuccess: async () => invalidateSlashCommandQueries(queryClient),
  });
}

export function useImportSlashCommandMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importSlashCommand,
    onSuccess: async () => invalidateSlashCommandQueries(queryClient),
  });
}

export function useResolveSlashCommandReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SlashCommandResolveRequest) => resolveSlashCommandReview(body),
    onSuccess: async () => invalidateSlashCommandQueries(queryClient),
  });
}
