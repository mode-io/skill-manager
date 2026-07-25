import { deleteJson, fetchJson, postJson } from "../../../api/http";

import type {
  HookApplyConfigResponseDto,
  HookInventoryDto,
  HookInventoryEntryDto,
  HookMutationResponseDto,
  HookSetHarnessesResponseDto,
} from "./management-types";

export async function fetchHooksInventory(): Promise<HookInventoryDto> {
  return fetchJson<HookInventoryDto>("/hooks");
}

export async function enableHook(args: {
  id: string;
  harness: string;
}): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>(`/hooks/${encodeURIComponent(args.id)}/enable`, {
    harness: args.harness,
  });
}

export async function disableHook(args: {
  id: string;
  harness: string;
}): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>(`/hooks/${encodeURIComponent(args.id)}/disable`, {
    harness: args.harness,
  });
}

export async function setHookHarnesses(args: {
  id: string;
  target: "enabled" | "disabled";
}): Promise<HookSetHarnessesResponseDto> {
  return postJson<HookSetHarnessesResponseDto>(
    `/hooks/${encodeURIComponent(args.id)}/set-harnesses`,
    { target: args.target },
  );
}

export async function uninstallHook(id: string): Promise<HookSetHarnessesResponseDto> {
  return deleteJson<HookSetHarnessesResponseDto>(`/hooks/${encodeURIComponent(id)}`);
}

export async function fetchHookDetail(id: string): Promise<HookInventoryEntryDto> {
  return fetchJson<HookInventoryEntryDto>(`/hooks/${encodeURIComponent(id)}`);
}

export async function createHook(body: {
  id: string;
  event: string;
  command: string;
  match?: string | null;
  timeout?: number | null;
  description?: string;
}): Promise<HookMutationResponseDto> {
  return postJson<HookMutationResponseDto>("/hooks", body);
}

export async function promoteHook(args: {
  id: string;
  observedHarness?: string | null;
}): Promise<HookMutationResponseDto> {
  return postJson<HookMutationResponseDto>(
    `/hooks/${encodeURIComponent(args.id)}/promote`,
    { observedHarness: args.observedHarness ?? null },
  );
}

export async function reconcileHook(args: {
  id: string;
  sourceKind: "managed" | "harness";
  observedHarness?: string | null;
  harnesses?: string[];
}): Promise<HookApplyConfigResponseDto> {
  return postJson<HookApplyConfigResponseDto>(
    `/hooks/${encodeURIComponent(args.id)}/reconcile`,
    {
      sourceKind: args.sourceKind,
      observedHarness: args.observedHarness ?? null,
      harnesses: args.harnesses,
    },
  );
}
