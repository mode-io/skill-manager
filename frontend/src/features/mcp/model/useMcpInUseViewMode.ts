import { usePersistentViewMode } from "../../../lib/usePersistentViewMode";

export type McpInUseViewMode = "cards" | "matrix";

const STORAGE_KEY = "skillmgr.mcp.inUse.view";

function isValidMode(value: unknown): value is McpInUseViewMode {
  return value === "cards" || value === "matrix";
}

export function useMcpInUseViewMode(): [McpInUseViewMode, (next: McpInUseViewMode) => void] {
  return usePersistentViewMode<McpInUseViewMode>({
    storageKey: STORAGE_KEY,
    defaultMode: "cards",
    isValidMode,
  });
}
