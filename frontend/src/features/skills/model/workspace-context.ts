import { useOutletContext } from "react-router-dom";

import type { HarnessCell, SkillListRow, SkillsWorkspaceData } from "./types";

export interface SkillsWorkspaceContextValue {
  data: SkillsWorkspaceData | null;
  hasData: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  status: "loading" | "ready" | "error";
  errorMessage: string;
  busyId: string | null;
  selectedSkillRef: string | null;
  onManageAll: () => void;
  onManageSkill: (skillRef: string) => Promise<void>;
  onOpenSkill: (skillRef: string) => void;
  onToggleCell: (row: SkillListRow, cell: HarnessCell) => void;
}

export function useSkillsWorkspace(): SkillsWorkspaceContextValue {
  return useOutletContext<SkillsWorkspaceContextValue>();
}
