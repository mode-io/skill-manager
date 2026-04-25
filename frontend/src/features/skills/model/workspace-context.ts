import { useOutletContext } from "react-router-dom";

import type { MultiSelectAction } from "../../../components/BulkActionBar";
import type { BulkSkillsAction, CellActionKey, StructuralSkillAction } from "./pending";
import type { HarnessCell, SkillListRow, SkillsWorkspaceData } from "./types";

export type { MultiSelectAction };

export type SetAllHarnessesTarget = "enabled" | "disabled";

export interface SetAllHarnessesFailure {
  harness: string;
  error: Error;
}

export interface SetAllHarnessesResult {
  succeeded: string[];
  failed: SetAllHarnessesFailure[];
}

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
  multiSelectedRefs: ReadonlySet<string>;
  multiSelectPending: MultiSelectAction | null;
  onManageAll: () => void;
  onManageSkill: (skillRef: string) => Promise<void>;
  onOpenSkill: (skillRef: string) => void;
  onToggleCell: (row: SkillListRow, cell: HarnessCell) => void;
  onToggleMultiSelect: (skillRef: string) => void;
  onClearMultiSelect: () => void;
  onMultiSelectEnableAll: () => Promise<void>;
  onMultiSelectDisableAll: () => Promise<void>;
  onMultiSelectDelete: () => Promise<void>;
  onSetSkillAllHarnesses: (skillRef: string, target: SetAllHarnessesTarget) => Promise<SetAllHarnessesResult>;
  onSetManySkillsAllHarnesses: (
    skillRefs: string[],
    target: SetAllHarnessesTarget,
  ) => Promise<Map<string, SetAllHarnessesResult>>;
  onUpdateSkill: (skillRef: string) => Promise<void>;
  onRemoveSkill: (skillRef: string) => Promise<void>;
  onDeleteSkill: (skillRef: string) => Promise<void>;
}

export function useSkillsWorkspace(): SkillsWorkspaceContextValue {
  return useOutletContext<SkillsWorkspaceContextValue>();
}
