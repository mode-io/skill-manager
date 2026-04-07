import { SkillDetailView } from "./SkillDetailView";

interface SkillDetailDrawerProps {
  skillRef: string | null;
  onClose: () => void;
  onManageSkill: (skillRef: string) => Promise<void>;
  onUpdateSkill: (skillRef: string) => Promise<void>;
}

export function SkillDetailDrawer({
  skillRef,
  onClose,
  onManageSkill,
  onUpdateSkill,
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
          onClose={onClose}
          onManageSkill={onManageSkill}
          onUpdateSkill={onUpdateSkill}
        />
      </aside>
    </>
  );
}
