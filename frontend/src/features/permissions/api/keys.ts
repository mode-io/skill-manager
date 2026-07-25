export const HOOKS_STALE_TIME_MS = 30_000;
export const HOOKS_GC_TIME_MS = 5 * 60_000;
export const HOOKS_INVENTORY_REFETCH_INTERVAL_MS = 5_000;

export const permissionsManagementKeys = {
  all: ["permissions"] as const,
  inventory: () => ["permissions", "inventory"] as const,
  detail: (id: string) => ["permissions", "detail", id] as const,
};
