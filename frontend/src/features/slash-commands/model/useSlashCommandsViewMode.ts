import { usePersistentViewMode } from "../../../lib/usePersistentViewMode";

export type SlashCommandsViewMode = "grid" | "board" | "matrix";

const STORAGE_KEY = "skillmgr.slashCommands.view";

function isValidMode(value: unknown): value is SlashCommandsViewMode {
  return value === "grid" || value === "board" || value === "matrix";
}

export function useSlashCommandsViewMode(): [
  SlashCommandsViewMode,
  (next: SlashCommandsViewMode) => void,
] {
  return usePersistentViewMode<SlashCommandsViewMode>({
    storageKey: STORAGE_KEY,
    defaultMode: "grid",
    isValidMode,
  });
}
