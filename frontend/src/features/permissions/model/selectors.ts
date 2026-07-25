import type {
  PermissionBindingDto,
  PermissionInventoryColumnDto,
  PermissionInventoryDto,
  PermissionInventoryEntryDto,
} from "../api/management-types";
import { permissionsCopy, type PermissionsCopy } from "../i18n";

export type InUsePillValue = "all" | "enabled" | "all-harnesses" | "unbound" | "drifted";

export interface PermissionsInUseFilters {
  search: string;
  pill: InUsePillValue;
}

export type PermissionsMatrixCellState = "enabled" | "disabled" | "different" | "unavailable" | "observed";

export interface PermissionsMatrixCellModel {
  state: PermissionsMatrixCellState;
  binding: PermissionBindingDto | null;
  writable: boolean;
  pendingKey: string;
  tooltip: string;
  ariaLabel: string;
  action: "enable" | "disable" | "resolve" | "open" | null;
}

export function isPermissionsHarnessAddressable(column: PermissionInventoryColumnDto): boolean {
  return column.permissionsWritable !== false && (column.installed || column.configPresent);
}

function inUseBindingCount(
  entry: PermissionInventoryEntryDto,
  addressable?: ReadonlySet<string>,
): number {
  return entry.sightings.filter(
    (b) => b.state === "managed" && (!addressable || addressable.has(b.harness)),
  ).length;
}

function hasDrift(entry: PermissionInventoryEntryDto, addressable?: ReadonlySet<string>): boolean {
  return entry.sightings.some(
    (b) => b.state === "drifted" && (!addressable || addressable.has(b.harness)),
  );
}

function addressableHarnesses(inventory: PermissionInventoryDto): ReadonlySet<string> {
  return new Set(inventory.columns.filter(isPermissionsHarnessAddressable).map((column) => column.harness));
}

function matchesSearch(entry: PermissionInventoryEntryDto, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  if (entry.id.toLowerCase().includes(needle)) return true;
  if (entry.displayName.toLowerCase().includes(needle)) return true;
  if (entry.spec?.pattern && entry.spec.pattern.toLowerCase().includes(needle)) return true;
  if (entry.spec?.decision && entry.spec.decision.toLowerCase().includes(needle)) return true;
  if (entry.spec?.scope && entry.spec.scope.toLowerCase().includes(needle)) return true;
  return false;
}

export function filterPermissionsInUse(
  inventory: PermissionInventoryDto | null,
  filters: PermissionsInUseFilters,
): PermissionInventoryEntryDto[] {
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

export function filterPermissionsNeedsReview(
  inventory: PermissionInventoryDto | null,
  search = "",
): PermissionInventoryEntryDto[] {
  if (!inventory) return [];
  const needle = search.trim();
  return inventory.entries.filter(
    (entry) => entry.kind === "unmanaged" && matchesSearch(entry, needle),
  );
}

export function pillCounts(inventory: PermissionInventoryDto | null): Record<InUsePillValue, number> {
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

export function matrixColumns(inventory: { columns: PermissionInventoryColumnDto[] } | null): PermissionInventoryColumnDto[] {
  return inventory?.columns ?? [];
}

export function matrixCellFor(
  entry: PermissionInventoryEntryDto,
  column: PermissionInventoryColumnDto,
  copy: PermissionsCopy = permissionsCopy.en,
): PermissionsMatrixCellModel {
  const binding = entry.sightings.find((candidate) => candidate.harness === column.harness) ?? null;
  const writable = isPermissionsHarnessAddressable(column);
  const pendingKey = `${entry.id}:${column.harness}`;
  const baseLabel = `${entry.displayName} on ${column.label}`;

  let cell: PermissionsMatrixCellModel;

  if (binding?.state === "managed") {
    cell = {
      state: "enabled",
      binding,
      writable,
      pendingKey,
      tooltip: `Applied on ${column.label}`,
      ariaLabel: `Remove ${baseLabel}`,
      action: "disable",
    };
  } else if (binding?.state === "drifted") {
    const detail = binding.driftDetail ? ` (${binding.driftDetail})` : "";
    cell = {
      state: "different",
      binding,
      writable,
      pendingKey,
      tooltip: `Config differs on ${column.label}${detail}`,
      ariaLabel: `Resolve config for ${baseLabel}`,
      action: "resolve",
    };
  } else if (binding?.state === "unmanaged") {
    cell = {
      state: "observed",
      binding,
      writable,
      pendingKey,
      tooltip: `Untracked on ${column.label}`,
      ariaLabel: `Open details for ${baseLabel}`,
      action: "open",
    };
  } else if (!writable || !entry.canEnable) {
    cell = {
      state: "unavailable",
      binding,
      writable,
      pendingKey,
      tooltip: column.permissionsUnavailableReason ?? "Unavailable",
      ariaLabel: `Unavailable for ${baseLabel}`,
      action: null,
    };
  } else {
    cell = {
      state: "disabled",
      binding,
      writable,
      pendingKey,
      tooltip: `Not applied on ${column.label}`,
      ariaLabel: `Apply ${baseLabel}`,
      action: "enable",
    };
  }

  if (binding?.caveat) {
    cell.tooltip = `${cell.tooltip} (Caveat: ${binding.caveat})`;
  }

  return cell;
}

export function matrixCoverage(
  entry: PermissionInventoryEntryDto,
  columns: readonly PermissionInventoryColumnDto[],
): { enabled: number; writable: number } {
  const addressable = new Set(columns.filter(isPermissionsHarnessAddressable).map((column) => column.harness));
  return {
    enabled: entry.sightings.filter(
      (binding) => addressable.has(binding.harness) && binding.state === "managed",
    ).length,
    writable: addressable.size,
  };
}
