import { usePersistentViewMode } from "../../../lib/usePersistentViewMode";

export type InUseViewMode = "grid" | "board" | "matrix";

const STORAGE_KEY = "skillmgr.inUse.view";

function isValidMode(value: unknown): value is InUseViewMode {
  return value === "grid" || value === "board" || value === "matrix";
}

function normalizeLegacyMode(value: unknown): InUseViewMode | null {
  return value === "table" ? "matrix" : null;
}

/**
 * Resolution order on first render:
 *   1. `?view=` in the URL (shareable link)
 *   2. localStorage (persisted user choice)
 *   3. "grid" (default)
 *
 * User toggles write BOTH localStorage AND the URL param.
 * A URL override alone never writes to localStorage (so share links don't
 * permanently flip someone else's preference).
 */
export function useInUseViewMode(): [InUseViewMode, (next: InUseViewMode) => void] {
  return usePersistentViewMode<InUseViewMode>({
    storageKey: STORAGE_KEY,
    defaultMode: "grid",
    isValidMode,
    normalizeMode: normalizeLegacyMode,
  });
}
