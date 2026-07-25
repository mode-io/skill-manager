import type { AgentInventoryDto, AgentInventoryEntryDto } from "../api/types";

export type InUsePillValue = "all" | "enabled" | "all-harnesses" | "off";

export function countEnabledBindings(entry: AgentInventoryEntryDto): number {
  return entry.bindings.filter((b) => b.state === "enabled").length;
}

export function filterAgentsInUse(
  inventory: AgentInventoryDto | null,
  filters: { search: string; pill: InUsePillValue }
): AgentInventoryEntryDto[] {
  if (!inventory) return [];
  const managed = inventory.entries.filter((e) => e.kind === "managed");
  const harnessCount = inventory.columns.length;

  return managed.filter((entry) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!entry.name.toLowerCase().includes(q) && !entry.description.toLowerCase().includes(q)) {
        return false;
      }
    }
    const enabled = countEnabledBindings(entry);
    if (filters.pill === "enabled" && enabled === 0) return false;
    if (filters.pill === "all-harnesses" && (enabled !== harnessCount || harnessCount === 0)) return false;
    if (filters.pill === "off" && enabled > 0) return false;
    return true;
  });
}

export function pillCounts(inventory: AgentInventoryDto | null): Record<InUsePillValue, number> {
  const managed = inventory?.entries.filter((e) => e.kind === "managed") ?? [];
  const harnessCount = inventory?.columns.length ?? 0;
  return {
    all: managed.length,
    enabled: managed.filter((e) => countEnabledBindings(e) > 0).length,
    "all-harnesses": managed.filter((e) => countEnabledBindings(e) === harnessCount && harnessCount > 0).length,
    off: managed.filter((e) => countEnabledBindings(e) === 0).length,
  };
}

export function filterAgentsNeedsReview(
  inventory: AgentInventoryDto | null,
  search: string
): AgentInventoryEntryDto[] {
  if (!inventory) return [];
  const unmanaged = inventory.entries.filter((e) => e.kind === "unmanaged");
  if (!search) return unmanaged;
  const q = search.toLowerCase();
  return unmanaged.filter(
    (e) => e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
  );
}
