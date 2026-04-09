import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  deleteSkill,
  disableSkill,
  enableSkill,
  fetchSkillDetail,
  fetchSkillsPage,
  manageAllSkills,
  manageSkill,
  unmanageSkill,
  updateSkill,
} from "./client";
import { mapSkillDetail, mapSkillsPage } from "./mappers";
import type { HarnessCellState, SkillsWorkspaceData } from "../model/types";

const SKILLS_STALE_TIME_MS = 60_000;
const SKILLS_GC_TIME_MS = 15 * 60_000;

export const skillsKeys = {
  all: ["skills"] as const,
  list: () => ["skills", "list"] as const,
  detailPrefix: () => ["skills", "detail"] as const,
  detail: (skillRef: string) => ["skills", "detail", skillRef] as const,
};

export function useSkillsListQuery() {
  return useQuery({
    queryKey: skillsKeys.list(),
    queryFn: fetchSkillsPage,
    select: mapSkillsPage,
    staleTime: SKILLS_STALE_TIME_MS,
    gcTime: SKILLS_GC_TIME_MS,
    refetchOnWindowFocus: false,
  });
}

export function useSkillDetailQuery(skillRef: string | null) {
  return useQuery({
    queryKey: skillsKeys.detail(skillRef ?? "__none__"),
    queryFn: () => fetchSkillDetail(skillRef!),
    select: mapSkillDetail,
    enabled: Boolean(skillRef),
    staleTime: SKILLS_STALE_TIME_MS,
    gcTime: SKILLS_GC_TIME_MS,
    refetchOnWindowFocus: false,
  });
}

export async function invalidateSkillsQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: skillsKeys.list() }),
    queryClient.invalidateQueries({ queryKey: skillsKeys.detailPrefix() }),
  ]);
}

export function useToggleSkillMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      skillRef,
      harness,
      nextState,
    }: {
      skillRef: string;
      harness: string;
      nextState: HarnessCellState;
    }) => {
      if (nextState === "enabled") {
        return enableSkill(skillRef, harness);
      }
      return disableSkill(skillRef, harness);
    },
    onMutate: async ({ skillRef, harness, nextState }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: skillsKeys.list() }),
      ]);

      const previousList = queryClient.getQueryData<SkillsWorkspaceData>(skillsKeys.list());

      if (previousList) {
        queryClient.setQueryData<SkillsWorkspaceData>(
          skillsKeys.list(),
          patchSkillsListToggle(previousList, skillRef, harness, nextState),
        );
      }

      return { previousList, skillRef };
    },
    onError: (_error, variables, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(skillsKeys.list(), context.previousList);
      }
    },
    onSettled: async (_data, _error, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: skillsKeys.list() }),
        queryClient.invalidateQueries({ queryKey: skillsKeys.detail(variables.skillRef) }),
      ]);
    },
  });
}

export function useManageSkillMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skillRef }: { skillRef: string }) => manageSkill(skillRef),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: skillsKeys.list() }),
        queryClient.invalidateQueries({ queryKey: skillsKeys.detail(variables.skillRef) }),
      ]);
    },
  });
}

export function useManageAllSkillsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: manageAllSkills,
    onSuccess: async () => {
      await invalidateSkillsQueries(queryClient);
    },
  });
}

export function useUpdateSkillMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skillRef }: { skillRef: string }) => updateSkill(skillRef),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: skillsKeys.list() }),
        queryClient.invalidateQueries({ queryKey: skillsKeys.detail(variables.skillRef) }),
      ]);
    },
  });
}

export function useUnmanageSkillMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skillRef }: { skillRef: string }) => unmanageSkill(skillRef),
    onSuccess: async (_data, variables) => {
      queryClient.removeQueries({ queryKey: skillsKeys.detail(variables.skillRef), exact: true });
      await invalidateSkillsQueries(queryClient);
    },
  });
}

export function useDeleteSkillMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skillRef }: { skillRef: string }) => deleteSkill(skillRef),
    onMutate: async ({ skillRef }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: skillsKeys.list() }),
        queryClient.cancelQueries({ queryKey: skillsKeys.detail(skillRef) }),
      ]);

      const previousList = queryClient.getQueryData<SkillsWorkspaceData>(skillsKeys.list());
      const previousDetail = queryClient.getQueryData(skillsKeys.detail(skillRef));

      if (previousList) {
        queryClient.setQueryData<SkillsWorkspaceData>(skillsKeys.list(), removeSkillFromList(previousList, skillRef));
      }
      queryClient.removeQueries({ queryKey: skillsKeys.detail(skillRef), exact: true });

      return { previousList, previousDetail, skillRef };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(skillsKeys.list(), context.previousList);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(skillsKeys.detail(context.skillRef), context.previousDetail);
      }
    },
    onSuccess: async (_data, variables) => {
      queryClient.removeQueries({ queryKey: skillsKeys.detail(variables.skillRef), exact: true });
      await invalidateSkillsQueries(queryClient);
    },
  });
}

function patchSkillsListToggle(
  data: SkillsWorkspaceData,
  skillRef: string,
  harness: string,
  nextState: HarnessCellState,
): SkillsWorkspaceData {
  return {
    ...data,
    rows: data.rows.map((row) =>
      row.skillRef !== skillRef
        ? row
        : {
            ...row,
            cells: row.cells.map((cell) =>
              cell.harness !== harness ? cell : { ...cell, state: nextState },
            ),
          },
    ),
  };
}

function removeSkillFromList(data: SkillsWorkspaceData, skillRef: string): SkillsWorkspaceData {
  const removedRow = data.rows.find((row) => row.skillRef === skillRef);
  if (!removedRow) {
    return data;
  }

  return {
    ...data,
    summary: {
      ...data.summary,
      managed: removedRow.displayStatus === "Managed" ? Math.max(0, data.summary.managed - 1) : data.summary.managed,
      unmanaged: removedRow.displayStatus === "Unmanaged" ? Math.max(0, data.summary.unmanaged - 1) : data.summary.unmanaged,
      custom: removedRow.displayStatus === "Custom" ? Math.max(0, data.summary.custom - 1) : data.summary.custom,
      builtIn: removedRow.displayStatus === "Built-in" ? Math.max(0, data.summary.builtIn - 1) : data.summary.builtIn,
    },
    rows: data.rows.filter((row) => row.skillRef !== skillRef),
  };
}
