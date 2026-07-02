import { usePersistentViewMode } from "../../../lib/usePersistentViewMode";

export type HooksInUseViewMode = "cards" | "matrix";

const STORAGE_KEY = "skillmgr.hooks.inUse.view";

function isValidMode(value: unknown): value is HooksInUseViewMode {
  return value === "cards" || value === "matrix";
}

export function useHooksInUseViewMode(): [HooksInUseViewMode, (next: HooksInUseViewMode) => void] {
  return usePersistentViewMode<HooksInUseViewMode>({
    storageKey: STORAGE_KEY,
    defaultMode: "cards",
    isValidMode,
  });
}
