import { useRef } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { ScopedReconciliationTracker } from "../../../lib/async/scoped-reconciliation";
import {
  deleteSkill,
  disableSkill,
  enableSkill,
  fetchSkillDetail,
  fetchSkillSourceStatus,
  fetchSkillsPage,
  manageAllSkills,
  manageSkill,
  unmanageSkill,
  updateSkill,
} from "./client";
import { mapSkillDetail, mapSkillsPage } from "./mappers";
import type { HarnessCellState } from "../model/types";
import type { HarnessCell, SkillDetailDto, SkillsPageDto } from "./types";

const SKILLS_STALE_TIME_MS = 60_000;
const SKILLS_GC_TIME_MS = 15 * 60_000;

export const skillsKeys = {
  all: ["skills"] as const,
  list: () => ["skills", "list"] as const,
  detailPrefix: () => ["skills", "detail"] as const,
  detail: (skillRef: string) => ["skills", "detail", skillRef] as const,
  sourceStatusPrefix: () => ["skills", "source-status"] as const,
  sourceStatus: (skillRef: string) => ["skills", "source-status", skillRef] as const,
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

export function useSkillSourceStatusQuery(skillRef: string | null) {
  return useQuery({
    queryKey: skillsKeys.sourceStatus(skillRef ?? "__none__"),
    queryFn: () => fetchSkillSourceStatus(skillRef!),
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
    queryClient.invalidateQueries({ queryKey: skillsKeys.sourceStatusPrefix() }),
  ]);
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
    onError: (_error, variables, context) => {
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

function patchSkillsListToggle(
  data: SkillsPageDto,
  skillRef: string,
  harness: string,
  nextState: HarnessCellState,
): SkillsPageDto {
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

function patchSkillDetailToggle(
  data: SkillDetailDto,
  harness: string,
  nextState: HarnessCellState,
): SkillDetailDto {
  return {
    ...data,
    harnessCells: data.harnessCells.map((cell) =>
      cell.harness !== harness ? cell : { ...cell, state: nextState },
    ),
  };
}

function getListCellState(
  data: SkillsPageDto | undefined,
  skillRef: string,
  harness: string,
): HarnessCellState | null {
  return findHarnessCell(
    data?.rows.find((row) => row.skillRef === skillRef)?.cells,
    harness,
  )?.state ?? null;
}

function getDetailCellState(
  data: SkillDetailDto | undefined,
  harness: string,
): HarnessCellState | null {
  return findHarnessCell(data?.harnessCells, harness)?.state ?? null;
}

function findHarnessCell(
  cells: HarnessCell[] | undefined,
  harness: string,
): HarnessCell | undefined {
  return cells?.find((cell) => cell.harness === harness);
}

function removeSkillFromList(data: SkillsPageDto, skillRef: string): SkillsPageDto {
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
