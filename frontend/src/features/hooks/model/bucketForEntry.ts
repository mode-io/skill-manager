import type { HookInventoryColumnDto, HookInventoryEntryDto } from "../api/management-types";
import { matrixCoverage } from "./selectors";

export type HooksBucket = "disabled" | "selective" | "enabled";

export function bucketForHookEntry(
  entry: HookInventoryEntryDto,
  columns: readonly HookInventoryColumnDto[],
): HooksBucket {
  const { enabled, writable } = matrixCoverage(entry, columns);
  if (writable === 0 || enabled === 0) return "disabled";
  if (enabled === writable) return "enabled";
  return "selective";
}

export interface HookEntryBuckets {
  disabled: HookInventoryEntryDto[];
  selective: HookInventoryEntryDto[];
  enabled: HookInventoryEntryDto[];
}

export function bucketHookEntries(
  entries: readonly HookInventoryEntryDto[],
  columns: readonly HookInventoryColumnDto[],
): HookEntryBuckets {
  const result: HookEntryBuckets = { disabled: [], selective: [], enabled: [] };
  for (const entry of entries) {
    result[bucketForHookEntry(entry, columns)].push(entry);
  }
  return result;
}
