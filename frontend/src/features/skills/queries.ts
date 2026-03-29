import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  disableSkill,
  enableSkill,
  fetchSkillDetail,
  fetchSkillsPage,
  manageAllSkills,
  manageSkill,
  updateSkill,
} from "../../api/client";
import type { HarnessCellState, SkillsPageData } from "../../api/types";

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
    staleTime: SKILLS_STALE_TIME_MS,
    gcTime: SKILLS_GC_TIME_MS,
    refetchOnWindowFocus: false,
  });
}

export function useSkillDetailQuery(skillRef: string | null) {
  return useQuery({
    queryKey: skillsKeys.detail(skillRef ?? "__none__"),
    queryFn: () => fetchSkillDetail(skillRef!),
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

      const previousList = queryClient.getQueryData<SkillsPageData>(skillsKeys.list());

      if (previousList) {
        queryClient.setQueryData<SkillsPageData>(
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

function patchSkillsListToggle(
  data: SkillsPageData,
  skillRef: string,
  harness: string,
  nextState: HarnessCellState,
): SkillsPageData {
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
