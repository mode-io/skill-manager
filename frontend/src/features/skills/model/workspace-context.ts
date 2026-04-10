import { useOutletContext } from "react-router-dom";

import type { BulkSkillsAction, CellActionKey, StructuralSkillAction } from "./pending";
import type { HarnessCell, SkillListRow, SkillsWorkspaceData } from "./types";

export interface SkillsWorkspaceContextValue {
  data: SkillsWorkspaceData | null;
  hasData: boolean;
  isInitialLoading: boolean;
  status: "loading" | "ready" | "error";
  errorMessage: string;
  pendingToggleKeys: ReadonlySet<CellActionKey>;
  pendingStructuralActions: ReadonlyMap<string, StructuralSkillAction>;
  pendingBulkAction: BulkSkillsAction | null;
  selectedSkillRef: string | null;
  onManageAll: () => void;
  onManageSkill: (skillRef: string) => Promise<void>;
  onOpenSkill: (skillRef: string) => void;
  onToggleCell: (row: SkillListRow, cell: HarnessCell) => void;
}

export function useSkillsWorkspace(): SkillsWorkspaceContextValue {
  return useOutletContext<SkillsWorkspaceContextValue>();
}
