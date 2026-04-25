import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ScopedReconciliationTracker } from "../../../lib/async/scoped-reconciliation";
import { queryPolicy } from "../../../lib/query";
import {
  deleteSkill,
  disableSkill,
  enableSkill,
  fetchSkillDetail,
  fetchSkillSourceStatus,
  fetchSkillsPage,
  manageAllSkills,
  manageSkill,
  setSkillHarnesses,
  unmanageSkill,
  updateSkill,
} from "./client";
import {
  getDetailCellState,
  getListCellState,
  patchSkillDetailToggle,
  patchSkillsListToggle,
  removeSkillFromList,
} from "./cache-patches";
import { invalidateSkillsQueries } from "./invalidation";
import { SKILLS_GC_TIME_MS, SKILLS_STALE_TIME_MS, skillsKeys } from "./keys";
import { mapSkillDetail, mapSkillsPage } from "./mappers";
import type { HarnessCellState } from "../model/types";
import type { SetSkillHarnessesResultDto, SkillDetailDto, SkillsPageDto } from "./types";

export { invalidateSkillsQueries } from "./invalidation";
export { skillsKeys } from "./keys";

export function useSkillsListQuery() {
  return useQuery({
    queryKey: skillsKeys.list(),
    queryFn: fetchSkillsPage,
    select: mapSkillsPage,
    ...queryPolicy(SKILLS_STALE_TIME_MS, SKILLS_GC_TIME_MS),
  });
}

export function useSkillDetailQuery(skillRef: string | null) {
  return useQuery({
    queryKey: skillsKeys.detail(skillRef ?? "__none__"),
    queryFn: () => fetchSkillDetail(skillRef!),
    select: mapSkillDetail,
    enabled: Boolean(skillRef),
    ...queryPolicy(SKILLS_STALE_TIME_MS, SKILLS_GC_TIME_MS),
  });
}

export function useSkillSourceStatusQuery(skillRef: string | null) {
  return useQuery({
    queryKey: skillsKeys.sourceStatus(skillRef ?? "__none__"),
    queryFn: () => fetchSkillSourceStatus(skillRef!),
    enabled: Boolean(skillRef),
    ...queryPolicy(SKILLS_STALE_TIME_MS, SKILLS_GC_TIME_MS),
  });
}

export function useToggleSkillMutation() {
  const queryClient = useQueryClient();
  const reconciliationRef = useRef<ScopedReconciliationTracker<string> | null>(null);

  if (reconciliationRef.current === null) {
    reconciliationRef.current = new ScopedReconciliationTracker<string>();
  }

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
      reconciliationRef.current?.begin(skillRef);

      await Promise.all([
        queryClient.cancelQueries({ queryKey: skillsKeys.list() }),
        queryClient.cancelQueries({ queryKey: skillsKeys.detail(skillRef) }),
      ]);

      const previousList = queryClient.getQueryData<SkillsPageDto>(skillsKeys.list());
      const previousDetail = queryClient.getQueryData<SkillDetailDto>(skillsKeys.detail(skillRef));
      const previousListCellState = getListCellState(previousList, skillRef, harness);
      const previousDetailCellState = getDetailCellState(previousDetail, harness);

      if (previousList) {
        queryClient.setQueryData<SkillsPageDto>(
          skillsKeys.list(),
          patchSkillsListToggle(previousList, skillRef, harness, nextState),
        );
      }
      if (previousDetail) {
        queryClient.setQueryData<SkillDetailDto>(
          skillsKeys.detail(skillRef),
          patchSkillDetailToggle(previousDetail, harness, nextState),
        );
      }

      return {
        skillRef,
        harness,
        previousListCellState,
        previousDetailCellState,
      };
    },
    onError: (_error, _variables, context) => {
      if (!context) {
        return;
      }

      if (context.previousListCellState !== null) {
        const previousListCellState = context.previousListCellState;
        queryClient.setQueryData<SkillsPageDto>(
          skillsKeys.list(),
          (current) => current ? patchSkillsListToggle(
            current,
            context.skillRef,
            context.harness,
            previousListCellState,
          ) : current,
        );
      }
      if (context.previousDetailCellState !== null) {
        const previousDetailCellState = context.previousDetailCellState;
        queryClient.setQueryData<SkillDetailDto>(
          skillsKeys.detail(context.skillRef),
          (current) => current ? patchSkillDetailToggle(
            current,
            context.harness,
            previousDetailCellState,
          ) : current,
        );
      }
    },
    onSettled: async (_data, _error, variables) => {
      const decision = reconciliationRef.current?.finish(variables.skillRef) ?? {
        invalidateAll: true,
        invalidateScope: true,
      };
      const invalidations: Promise<unknown>[] = [];

      if (decision.invalidateScope) {
        invalidations.push(queryClient.invalidateQueries({ queryKey: skillsKeys.detail(variables.skillRef) }));
        invalidations.push(queryClient.invalidateQueries({ queryKey: skillsKeys.sourceStatus(variables.skillRef) }));
      }

      if (decision.invalidateAll) {
        invalidations.push(queryClient.invalidateQueries({ queryKey: skillsKeys.list() }));
      }

      if (invalidations.length > 0) {
        await Promise.all(invalidations);
      }
    },
  });
}

export function useSetSkillHarnessesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      skillRef,
      target,
    }: {
      skillRef: string;
      target: "enabled" | "disabled";
    }): Promise<SetSkillHarnessesResultDto> => {
      return setSkillHarnesses(skillRef, target);
    },
    onMutate: async ({ skillRef, target }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: skillsKeys.list() }),
        queryClient.cancelQueries({ queryKey: skillsKeys.detail(skillRef) }),
      ]);

      const previousList = queryClient.getQueryData<SkillsPageDto>(skillsKeys.list());
      const previousDetail = queryClient.getQueryData<SkillDetailDto>(skillsKeys.detail(skillRef));

      const row = previousList?.rows.find((candidate) => candidate.skillRef === skillRef);
      const flippingHarnesses = row
        ? row.cells
            .filter((cell) => cell.interactive && cell.state !== target)
            .map((cell) => cell.harness)
        : [];

      if (previousList && flippingHarnesses.length > 0) {
        let patched = previousList;
        for (const harness of flippingHarnesses) {
          patched = patchSkillsListToggle(patched, skillRef, harness, target);
        }
        queryClient.setQueryData<SkillsPageDto>(skillsKeys.list(), patched);
      }

      if (previousDetail && flippingHarnesses.length > 0) {
        let patched = previousDetail;
        for (const harness of flippingHarnesses) {
          patched = patchSkillDetailToggle(patched, harness, target);
        }
        queryClient.setQueryData<SkillDetailDto>(skillsKeys.detail(skillRef), patched);
      }

      return { skillRef, previousList, previousDetail };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      if (context.previousList !== undefined) {
        queryClient.setQueryData<SkillsPageDto>(skillsKeys.list(), context.previousList);
      }
      if (context.previousDetail !== undefined) {
        queryClient.setQueryData<SkillDetailDto>(skillsKeys.detail(context.skillRef), context.previousDetail);
      }
    },
    onSettled: async (_data, _error, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: skillsKeys.list() }),
        queryClient.invalidateQueries({ queryKey: skillsKeys.detail(variables.skillRef) }),
        queryClient.invalidateQueries({ queryKey: skillsKeys.sourceStatus(variables.skillRef) }),
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
        queryClient.invalidateQueries({ queryKey: skillsKeys.sourceStatus(variables.skillRef) }),
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
        queryClient.invalidateQueries({ queryKey: skillsKeys.sourceStatus(variables.skillRef) }),
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
      queryClient.removeQueries({ queryKey: skillsKeys.sourceStatus(variables.skillRef), exact: true });
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
        queryClient.cancelQueries({ queryKey: skillsKeys.sourceStatus(skillRef) }),
      ]);

      const previousList = queryClient.getQueryData<SkillsPageDto>(skillsKeys.list());
      const previousDetail = queryClient.getQueryData(skillsKeys.detail(skillRef));

      if (previousList) {
        queryClient.setQueryData<SkillsPageDto>(skillsKeys.list(), removeSkillFromList(previousList, skillRef));
      }
      queryClient.removeQueries({ queryKey: skillsKeys.detail(skillRef), exact: true });
      queryClient.removeQueries({ queryKey: skillsKeys.sourceStatus(skillRef), exact: true });

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
      queryClient.removeQueries({ queryKey: skillsKeys.sourceStatus(variables.skillRef), exact: true });
      await invalidateSkillsQueries(queryClient);
    },
  });
}
