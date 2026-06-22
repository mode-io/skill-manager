import type { QueryClient } from "@tanstack/react-query";

import { mcpManagementKeys } from "./keys";
import type {
  McpAvailabilityCheckResponseDto,
  McpBindingDto,
  McpInventoryDto,
  McpInventoryColumnDto,
  McpInventoryEntryDto,
  McpServerDetailDto,
  McpStatusDto,
} from "./management-types";

export async function invalidateMcpQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: mcpManagementKeys.all });
}

export async function invalidateMcpInventoryQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: mcpManagementKeys.inventory() }),
    queryClient.invalidateQueries({ queryKey: ["mcp", "detail"] }),
  ]);
}

export async function invalidateMcpReviewQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: mcpManagementKeys.needsReviewByServer() });
}

export async function invalidateMcpAvailabilityQueries(
  queryClient: QueryClient,
  name: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: mcpManagementKeys.inventory() }),
    queryClient.invalidateQueries({ queryKey: mcpManagementKeys.detail(name) }),
  ]);
}

export function applyMcpAvailabilityResult(
  queryClient: QueryClient,
  response: McpAvailabilityCheckResponseDto,
): void {
  const mcpStatus = mcpStatusFromAvailability(response);
  queryClient.setQueryData<McpInventoryDto | undefined>(
    mcpManagementKeys.inventory(),
    (current) => current ? {
      ...current,
      entries: current.entries.map((entry) =>
        entry.name === response.name
          ? availabilityPatchedEntry(entry, response, mcpStatus)
          : entry,
      ),
    } : current,
  );
  queryClient.setQueryData<McpServerDetailDto | undefined>(
    mcpManagementKeys.detail(response.name),
    (current) => current ? {
      ...current,
      availabilityStatus: response.availabilityStatus,
      availabilityReason: response.availabilityReason ?? null,
      mcpStatus,
    } : current,
  );
}

export function applyMcpHarnessBindingState(
  queryClient: QueryClient,
  name: string,
  harness: string,
  state: McpBindingDto["state"],
): void {
  queryClient.setQueryData<McpInventoryDto | undefined>(
    mcpManagementKeys.inventory(),
    (current) => current ? {
      ...current,
      entries: current.entries.map((entry) =>
        entry.name === name ? bindingPatchedEntry(entry, harness, state, current.columns) : entry,
      ),
    } : current,
  );
  queryClient.setQueryData<McpServerDetailDto | undefined>(
    mcpManagementKeys.detail(name),
    (current) => {
      if (!current) {
        return current;
      }
      const sightings = patchBindings(current.sightings, harness, state);
      return {
        ...current,
        sightings,
        enabledStatus: enabledStatusForBindings(sightings),
      };
    },
  );
}

export function removeMcpServerFromCache(queryClient: QueryClient, name: string): void {
  queryClient.setQueryData<McpInventoryDto | undefined>(
    mcpManagementKeys.inventory(),
    (current) => current ? {
      ...current,
      entries: current.entries.filter((entry) => entry.name !== name),
    } : current,
  );
  queryClient.removeQueries({ queryKey: mcpManagementKeys.detail(name) });
}

function availabilityPatchedEntry(
  entry: McpInventoryEntryDto,
  response: McpAvailabilityCheckResponseDto,
  mcpStatus: McpStatusDto,
): McpInventoryEntryDto {
  return {
    ...entry,
    availabilityStatus: response.availabilityStatus,
    availabilityReason: response.availabilityReason ?? null,
    mcpStatus,
  };
}

function mcpStatusFromAvailability(response: McpAvailabilityCheckResponseDto): McpStatusDto {
  if (response.availabilityStatus === "available") {
    return { kind: "available", reason: null };
  }
  if (response.availabilityReason) {
    return { kind: "connection_issue", reason: response.availabilityReason };
  }
  return { kind: "unchecked", reason: null };
}

function bindingPatchedEntry(
  entry: McpInventoryEntryDto,
  harness: string,
  state: McpBindingDto["state"],
  columns: McpInventoryColumnDto[],
): McpInventoryEntryDto {
  const sightings = patchBindings(entry.sightings, harness, state);
  return {
    ...entry,
    sightings,
    enabledStatus: enabledStatusForBindings(sightings, columns),
  };
}

function patchBindings(
  bindings: McpBindingDto[],
  harness: string,
  state: McpBindingDto["state"],
): McpBindingDto[] {
  let found = false;
  const patched = bindings.map((binding) => {
    if (binding.harness !== harness) {
      return binding;
    }
    found = true;
    return { ...binding, state };
  });
  return found ? patched : [...patched, { harness, state, driftDetail: null }];
}

function enabledStatusForBindings(
  bindings: McpBindingDto[],
  columns?: McpInventoryColumnDto[],
): McpInventoryEntryDto["enabledStatus"] {
  const addressableHarnesses = columns ? new Set(
    columns
      .filter((column) => column.mcpWritable !== false && (column.installed || column.configPresent))
      .map((column) => column.harness),
  ) : null;
  return bindings.some((binding) =>
    binding.state === "managed"
    && (addressableHarnesses === null || addressableHarnesses.has(binding.harness))
  )
    ? "enabled"
    : "disabled";
}
