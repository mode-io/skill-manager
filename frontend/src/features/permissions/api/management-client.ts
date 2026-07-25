import { deleteJson, fetchJson, postJson } from "../../../api/http";

import type {
  PermissionApplyConfigResponseDto,
  PermissionInventoryDto,
  PermissionInventoryEntryDto,
  PermissionMutationResponseDto,
  PermissionSetHarnessesResponseDto,
} from "./management-types";

export async function fetchPermissionsInventory(): Promise<PermissionInventoryDto> {
  return fetchJson<PermissionInventoryDto>("/permissions");
}

export async function enablePermission(args: {
  id: string;
  harness: string;
}): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>(`/permissions/${encodeURIComponent(args.id)}/enable`, {
    harness: args.harness,
  });
}

export async function disablePermission(args: {
  id: string;
  harness: string;
}): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>(`/permissions/${encodeURIComponent(args.id)}/disable`, {
    harness: args.harness,
  });
}

export async function setPermissionHarnesses(args: {
  id: string;
  target: "enabled" | "disabled";
}): Promise<PermissionSetHarnessesResponseDto> {
  return postJson<PermissionSetHarnessesResponseDto>(
    `/permissions/${encodeURIComponent(args.id)}/set-harnesses`,
    { target: args.target },
  );
}

export async function uninstallPermission(id: string): Promise<PermissionSetHarnessesResponseDto> {
  return deleteJson<PermissionSetHarnessesResponseDto>(`/permissions/${encodeURIComponent(id)}`);
}

export async function fetchPermissionDetail(id: string): Promise<PermissionInventoryEntryDto> {
  return fetchJson<PermissionInventoryEntryDto>(`/permissions/${encodeURIComponent(id)}`);
}

export async function createPermission(body: {
  id: string;
  decision: string;
  scope: string;
  pattern?: string | null;
  description?: string;
}): Promise<PermissionMutationResponseDto> {
  return postJson<PermissionMutationResponseDto>("/permissions", body);
}

export async function promotePermission(args: {
  id: string;
  observedHarness?: string | null;
}): Promise<PermissionMutationResponseDto> {
  return postJson<PermissionMutationResponseDto>(
    `/permissions/${encodeURIComponent(args.id)}/promote`,
    { observedHarness: args.observedHarness ?? null },
  );
}

export async function reconcilePermission(args: {
  id: string;
  sourceKind: "managed" | "harness";
  observedHarness?: string | null;
  harnesses?: string[];
}): Promise<PermissionApplyConfigResponseDto> {
  return postJson<PermissionApplyConfigResponseDto>(
    `/permissions/${encodeURIComponent(args.id)}/reconcile`,
    {
      sourceKind: args.sourceKind,
      observedHarness: args.observedHarness ?? null,
      harnesses: args.harnesses,
    },
  );
}
