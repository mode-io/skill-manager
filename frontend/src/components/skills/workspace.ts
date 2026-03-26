import { useOutletContext } from "react-router-dom";

import type { HarnessCell, SkillTableRow, SkillsPageData } from "../../api/types";

export interface SkillsWorkspaceContextValue {
  data: SkillsPageData | null;
  status: "loading" | "ready" | "error";
  busyId: string | null;
  onManageAll: () => void;
  onOpenSkill: (skillRef: string) => void;
  onToggleCell: (row: SkillTableRow, cell: HarnessCell) => void;
  onRunPrimaryAction: (row: SkillTableRow) => void;
}

export function useSkillsWorkspace(): SkillsWorkspaceContextValue {
  return useOutletContext<SkillsWorkspaceContextValue>();
}
