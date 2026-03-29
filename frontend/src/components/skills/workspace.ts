import { useOutletContext } from "react-router-dom";

import type { HarnessCell, SkillTableRow, SkillsPageData } from "../../api/types";

export interface SkillsWorkspaceContextValue {
  data: SkillsPageData | null;
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
  onToggleCell: (row: SkillTableRow, cell: HarnessCell) => void;
}

export function useSkillsWorkspace(): SkillsWorkspaceContextValue {
  return useOutletContext<SkillsWorkspaceContextValue>();
}
