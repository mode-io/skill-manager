export const HOOKS_STALE_TIME_MS = 30_000;
export const HOOKS_GC_TIME_MS = 5 * 60_000;
export const HOOKS_INVENTORY_REFETCH_INTERVAL_MS = 5_000;

export const hooksManagementKeys = {
  all: ["hooks"] as const,
  inventory: () => ["hooks", "inventory"] as const,
  detail: (id: string) => ["hooks", "detail", id] as const,
};
