import type { HarnessCellState } from "../../model/types";
import type { StructuralSkillAction } from "../../model/pending";
import { SkillDetailView } from "./SkillDetailView";

interface SkillDetailDrawerProps {
  skillRef: string | null;
  pendingToggleHarnesses: ReadonlySet<string>;
  pendingStructuralAction: StructuralSkillAction | null;
  onClose: () => void;
  onManageSkill: (skillRef: string) => Promise<void>;
  onToggleSkill: (skillRef: string, harness: string, currentState: HarnessCellState) => Promise<void>;
  onUpdateSkill: (skillRef: string) => Promise<void>;
  onUnmanageSkill: (skillRef: string) => Promise<void>;
  onDeleteSkill: (skillRef: string) => Promise<void>;
}

export function SkillDetailDrawer({
  skillRef,
  pendingToggleHarnesses,
  pendingStructuralAction,
  onClose,
  onManageSkill,
  onToggleSkill,
  onUpdateSkill,
  onUnmanageSkill,
  onDeleteSkill,
}: SkillDetailDrawerProps) {
  if (!skillRef) {
    return null;
  }

  return (
    <>
      <button type="button" className="drawer-backdrop" aria-label="Close skill details" onClick={onClose} />
      <aside className="drawer drawer--detail ui-scrollbar" aria-label="Skill details drawer">
        <SkillDetailView
          skillRef={skillRef}
          pendingToggleHarnesses={pendingToggleHarnesses}
          pendingStructuralAction={pendingStructuralAction}
          onClose={onClose}
          onManageSkill={onManageSkill}
          onToggleSkill={onToggleSkill}
          onUpdateSkill={onUpdateSkill}
          onUnmanageSkill={onUnmanageSkill}
          onDeleteSkill={onDeleteSkill}
        />
      </aside>
    </>
  );
}
