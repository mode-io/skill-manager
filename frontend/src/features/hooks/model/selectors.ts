import type {
  HookBindingDto,
  HookInventoryColumnDto,
  HookInventoryDto,
  HookInventoryEntryDto,
} from "../api/management-types";
import { hooksCopy, type HooksCopy } from "../i18n";

export type InUsePillValue = "all" | "enabled" | "all-harnesses" | "unbound" | "drifted";

export interface HooksInUseFilters {
  search: string;
  pill: InUsePillValue;
}

export type HooksMatrixCellState = "enabled" | "disabled" | "different" | "unavailable" | "observed";

export interface HooksMatrixCellModel {
  state: HooksMatrixCellState;
  binding: HookBindingDto | null;
  writable: boolean;
  pendingKey: string;
  tooltip: string;
  ariaLabel: string;
  action: "enable" | "disable" | "resolve" | "open" | null;
}

export function isHooksHarnessAddressable(column: HookInventoryColumnDto): boolean {
  return column.hooksWritable !== false && (column.installed || column.configPresent);
}

function inUseBindingCount(
  entry: HookInventoryEntryDto,
  addressable?: ReadonlySet<string>,
): number {
  return entry.sightings.filter(
    (b) => b.state === "managed" && (!addressable || addressable.has(b.harness)),
  ).length;
}

function hasDrift(entry: HookInventoryEntryDto, addressable?: ReadonlySet<string>): boolean {
  return entry.sightings.some(
    (b) => b.state === "drifted" && (!addressable || addressable.has(b.harness)),
  );
}

function addressableHarnesses(inventory: HookInventoryDto): ReadonlySet<string> {
  return new Set(inventory.columns.filter(isHooksHarnessAddressable).map((column) => column.harness));
}

function matchesSearch(entry: HookInventoryEntryDto, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  if (entry.id.toLowerCase().includes(needle)) return true;
  if (entry.displayName.toLowerCase().includes(needle)) return true;
  if (entry.spec?.command && entry.spec.command.toLowerCase().includes(needle)) return true;
  if (entry.spec?.event && entry.spec.event.toLowerCase().includes(needle)) return true;
  return false;
}

export function filterHooksInUse(
  inventory: HookInventoryDto | null,
  filters: HooksInUseFilters,
): HookInventoryEntryDto[] {
  if (!inventory) return [];
  const addressable = addressableHarnesses(inventory);
  const harnessCount = addressable.size;
  return inventory.entries.filter((entry) => {
    if (entry.kind !== "managed") return false;
    if (!matchesSearch(entry, filters.search.trim())) return false;
    const enabledCount = inUseBindingCount(entry, addressable);
    switch (filters.pill) {
      case "all":
        return true;
      case "enabled":
        return enabledCount > 0;
      case "all-harnesses":
        return harnessCount > 0 && enabledCount === harnessCount;
      case "unbound":
        return enabledCount === 0 && !hasDrift(entry, addressable);
      case "drifted":
        return hasDrift(entry, addressable);
      default:
        return true;
    }
  });
}

export function pillCounts(inventory: HookInventoryDto | null): Record<InUsePillValue, number> {
  if (!inventory) {
    return { all: 0, enabled: 0, "all-harnesses": 0, unbound: 0, drifted: 0 };
  }
  const addressable = addressableHarnesses(inventory);
  const harnessCount = addressable.size;
  const inUseEntries = inventory.entries.filter((e) => e.kind === "managed");
  return {
    all: inUseEntries.length,
    enabled: inUseEntries.filter((e) => inUseBindingCount(e, addressable) > 0).length,
    "all-harnesses": inUseEntries.filter(
      (e) => harnessCount > 0 && inUseBindingCount(e, addressable) === harnessCount,
    ).length,
    unbound: inUseEntries.filter(
      (e) => inUseBindingCount(e, addressable) === 0 && !hasDrift(e, addressable),
    ).length,
    drifted: inUseEntries.filter((entry) => hasDrift(entry, addressable)).length,
  };
}

export function matrixColumns(inventory: { columns: HookInventoryColumnDto[] } | null): HookInventoryColumnDto[] {
  return inventory?.columns ?? [];
}

export function matrixCellFor(
  entry: HookInventoryEntryDto,
  column: HookInventoryColumnDto,
  copy: HooksCopy = hooksCopy.en,
): HooksMatrixCellModel {
  const binding = entry.sightings.find((candidate) => candidate.harness === column.harness) ?? null;
  const writable = isHooksHarnessAddressable(column);
  const pendingKey = `${entry.id}:${column.harness}`;
  const baseLabel = `${entry.displayName} on ${column.label}`;

  let cell: HooksMatrixCellModel;

  if (binding?.state === "managed") {
    cell = {
      state: "enabled",
      binding,
      writable,
      pendingKey,
      tooltip: `Enabled on ${column.label}`,
      ariaLabel: `Disable ${baseLabel}`,
      action: "disable",
    };
  } else if (binding?.state === "drifted") {
    const detail = binding.driftDetail ? ` (${binding.driftDetail})` : "";
    cell = {
      state: "different",
      binding,
      writable,
      pendingKey,
      tooltip: `Different config on ${column.label}${detail}`,
      ariaLabel: `Resolve config for ${baseLabel}`,
      action: "resolve",
    };
  } else if (binding?.state === "unmanaged") {
    cell = {
      state: "observed",
      binding,
      writable,
      pendingKey,
      tooltip: `Configured outside skill-manager on ${column.label}`,
      ariaLabel: `Open details for ${baseLabel}`,
      action: "open",
    };
  } else if (!writable || !entry.canEnable) {
    cell = {
      state: "unavailable",
      binding,
      writable,
      pendingKey,
      tooltip: column.hooksUnavailableReason ?? "Unavailable",
      ariaLabel: `Unavailable for ${baseLabel}`,
      action: null,
    };
  } else {
    cell = {
      state: "disabled",
      binding,
      writable,
      pendingKey,
      tooltip: `Disabled on ${column.label}`,
      ariaLabel: `Enable ${baseLabel}`,
      action: "enable",
    };
  }

  if (binding?.caveat) {
    cell.tooltip = `${cell.tooltip} (Caveat: ${binding.caveat})`;
  }

  return cell;
}

export function matrixCoverage(
  entry: HookInventoryEntryDto,
  columns: readonly HookInventoryColumnDto[],
): { enabled: number; writable: number } {
  const addressable = new Set(columns.filter(isHooksHarnessAddressable).map((column) => column.harness));
  return {
    enabled: entry.sightings.filter(
      (binding) => addressable.has(binding.harness) && binding.state === "managed",
    ).length,
    writable: addressable.size,
  };
}
